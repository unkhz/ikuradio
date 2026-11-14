// The Receiver. It asks the Radio what time it is and which Songs are
// playing and coming, fetches each coming Song whole from the Archive
// before it begins, and then plays it: every voice, every bed and every
// character of every line at its own moment, all against the Tactus, the
// Radio's clock. It never waits for anything while a Song plays, because
// everything a Song needs is already here.
//
// What the page shows and sounds is decided by one question, asked many
// times a second: what should have happened by now? Arriving late is only
// asking it for a later moment.

// The Radio serves this page itself, so it is found where the page came from.
const radio = ''

// The Tactus, as this page knows it. The Radio says what time it is; the
// page measures how long the asking took, and believes the answer that came
// back quickest, since it was the least delayed on its way.
const samples = []
let offset = 0 // the Radio's clock, less this page's, in milliseconds
const here = () => performance.timeOrigin + performance.now()
const now = () => here() + offset

async function askRadio() {
  const sent = here()
  const response = await fetch(`${radio}/tactus`, { cache: 'no-store' })
  const tactus = await response.json()
  const got = here()
  samples.push({ rtt: got - sent, offset: tactus.now - (sent + got) / 2 })
  if (samples.length > 12) samples.shift()
  offset = samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset
  return tactus
}

// The Songs this page knows. Each is fetched in the order it will be
// heard, from wherever the listener joins it; it may begin once the
// Recordings of its first stretch are here, and the rest follow behind.
const songs = new Map()

// The choir, in this page. A Session keeps every voice as its take, the
// score exactly as the Studio's throat was given it, and the page sings each
// one itself, with the same throat compiled to WebAssembly (throat.js), in a
// few Workers of its own. Every singer is sung apart, so the page may place
// each one where it likes in its mix. Takes are sung in the order they are
// heard, never more than a little ahead, and let go once they have been
// heard: a page left open for weeks holds only the next minute or two of song.

/** The rate the throat sings at. */
const throatRate = 48000
/** How far ahead of its moment a take is sung, at most, in seconds. */
const singingAhead = 90
/** How many throats sing at once: a few, and never all of the machine. */
const throatCount = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1))

const choir = { throats: undefined, idle: [], takes: [], jobs: new Map(), next: 0, failed: false }

/** Opens the throats, once: the engine and its dictionary are fetched and given to each. */
function openThroats() {
  choir.throats ??= (async () => {
    const [engine, dictionary] = await Promise.all([
      fetch('/throat/chimera.wasm').then((r) => {
        if (!r.ok) throw new Error(`the throat: ${r.status}`)
        return r.arrayBuffer()
      }),
      fetch('/throat/cmudict.txt.gz').then(async (r) => {
        if (!r.ok) throw new Error(`the dictionary: ${r.status}`)
        return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text()
      }),
    ])
    const opened = await Promise.all(
      Array.from({ length: throatCount }, async () => {
        const worker = new Worker('/throat-worker.js', { type: 'module' })
        const answer = await new Promise((resolve) => {
          worker.onmessage = ({ data }) => resolve(data)
          worker.onerror = (error) => resolve({ opened: false, error: String(error.message ?? error) })
          worker.postMessage({ open: { engine, dictionary } })
        })
        if (!answer.opened) {
          worker.terminate()
          return undefined
        }
        worker.onmessage = ({ data }) => sung(worker, data)
        return worker
      }),
    )
    choir.idle = opened.filter(Boolean)
    if (!choir.idle.length) throw new Error('no throat would open')
    // takes may already be waiting, and a Song played from its beginning waits
    // for its first ones before its clock starts: the throats begin at once
    singSoon()
  })().catch((error) => {
    // a page that cannot sing still plays the Music and types the words
    console.warn(`the page cannot sing: ${error}`)
    choir.failed = true
    for (const take of choir.takes.splice(0)) lose(take)
  })
  return choir.throats
}

/** When a take is wanted by, on the Tactus: its moment, or, for a Song not yet begun, as if it began now. */
function dueOf({ song, at }) {
  const begins = Number.isFinite(song.airing.begins) ? song.airing.begins : now()
  return begins + at * 1000
}

/** A take that will not be sung: its Song goes on without it. */
function lose({ song, id }) {
  song.gone.add(id)
  song.missing = song.gone.size
  song.done?.()
}

/** Asks for a take to be sung, for the first moment it is heard in its Song. */
function wantSung(song, recording) {
  const body = song.session.singers?.[recording.voice ?? 0]?.body ?? 'female'
  choir.takes.push({ song, id: recording.id, take: recording.take, body, at: recording.at, seconds: recording.seconds ?? 0 })
  if (choir.failed) lose(choir.takes.pop())
  else openThroats()
}

/** Gives every idle throat the take due soonest, if it is due soon enough. */
function singSoon() {
  if (!choir.idle.length || !choir.takes.length) return
  const moment = now()
  // takes of Songs let go, and takes whose moment is already over, are not sung
  choir.takes = choir.takes.filter(
    (t) => songs.get(t.song.airing.song) === t.song && dueOf(t) + t.seconds * 1000 > moment,
  )
  choir.takes.sort((a, b) => dueOf(a) - dueOf(b))
  while (choir.idle.length && choir.takes.length && dueOf(choir.takes[0]) - moment < singingAhead * 1000) {
    const take = choir.takes.shift()
    const job = choir.next++
    choir.jobs.set(job, take)
    choir.idle.pop().postMessage({ job, take: take.take, body: take.body })
  }
}

/** A take, sung: kept until it has been heard, and the throat sings on. */
function sung(worker, { job, samples, error }) {
  const take = choir.jobs.get(job)
  choir.jobs.delete(job)
  choir.idle.push(worker)
  if (take) {
    if (error) {
      console.warn(`a take could not be sung: ${error}`)
      lose(take)
    } else if (songs.get(take.song.airing.song) === take.song) {
      take.song.voices.set(take.id, samples)
      take.song.fetched++
      take.song.done?.()
    }
  }
  singSoon()
}

/** How many Recordings are fetched at once. */
const fetching = 6
/** How much of a Song, in seconds from where it is joined, must be here before it begins. */
const startingStretch = 20

function prepare(airing) {
  if (songs.has(airing.song)) return songs.get(airing.song)
  const song = { airing, session: undefined, files: new Map(), voices: new Map(), uses: new Map(), gone: new Set(), ready: false, startable: false, fetched: 0, needed: 0, missing: 0 }
  songs.set(airing.song, song)
  let started
  song.starting = new Promise((resolve) => (started = resolve))
  song.preparing = (async () => {
    song.session = await fetch(airing.session).then((r) => r.json())
    // joined late, a listener needs nothing that is already over
    const from = Number.isFinite(airing.begins) ? Math.max(0, (now() - airing.begins) / 1000) : 0
    const heard = song.session.recordings
      .filter(({ at, seconds, fade }) => seconds === undefined || at + seconds + (fade ?? 0) > from)
      .sort((a, b) => a.at - b.at)
    song.heard = new Set(heard)
    // the Music is fetched; the voices with takes are sung here, each once, however often it is heard
    const ids = [...new Set(heard.filter(({ take }) => !take).map(({ id }) => id))]
    const takes = new Map()
    for (const recording of heard) {
      if (!recording.take) continue
      if (!takes.has(recording.id)) takes.set(recording.id, recording)
      song.uses.set(recording.id, (song.uses.get(recording.id) ?? 0) + 1)
    }
    const first = new Set(heard.filter(({ at }) => at < from + startingStretch).map(({ id }) => id))
    song.needed = ids.length + takes.size
    song.first = first.size
    const here = (id) => song.files.has(id) || song.voices.has(id) || song.gone.has(id)
    song.done = () => {
      if (song.startable) return
      if (![...first].every(here)) return
      song.startable = true
      started()
    }
    for (const recording of takes.values()) wantSung(song, recording)
    song.done()
    const done = song.done
    const queue = [...ids]
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()
        for (let attempt = 0; ; attempt++) {
          try {
            const url = new URL(`recordings/${id}`, airing.archive)
            const response = await fetch(url)
            // a Song whose voices were lost before the Archive kept everything;
            // its words remain, and the rest of it is not asked for
            if ((response.status === 403 || response.status === 404) && attempt >= 1) {
              for (const lost of [id, ...queue.splice(0)]) song.gone.add(lost)
              song.missing = song.gone.size
              break
            }
            if (!response.ok) throw new Error(`${response.status}`)
            song.files.set(id, await response.arrayBuffer())
            song.fetched++
            break
          } catch {
            // the Archive is busy, or the way to it; ask again, a little later
            await new Promise((resolve) => setTimeout(resolve, Math.min(10_000, 500 * 2 ** attempt)))
          }
        }
        done()
      }
    }
    await Promise.all(Array.from({ length: fetching }, worker))
    song.ready = true
  })().catch(() => {
    // a Session that cannot be read is forgotten, and asked for again
    songs.delete(airing.song)
    started()
  })
  return song
}

/** Lets go of Songs that have ended. Their words stay on the page; their sounds do not. */
function forget() {
  for (const [name, song] of songs) {
    const ends = song.airing.begins + song.airing.seconds * 1000
    if (now() - ends > 30_000) songs.delete(name)
  }
}

function createGain(audioContext, gainValue) {
  const gain = audioContext.createGain()
  gain.gain.value = gainValue
  return { in: gain, gain, out: gain }
}

function createDelay(audioContext, delayValue, gainValue) {
  // Now, create a gain node (to control the volume of the echo)
  const gain = createGain(audioContext, gainValue)

  // And a delay node
  const delay = audioContext.createDelay(60)
  delay.delayTime.value = delayValue
  delay.connect(gain.in)

  // Connect the gain back to the delay to create a feedback loop
  gain.out.connect(delay)

  return { in: delay, gain: gain.in, out: gain.out }
}


// The mix by ear: every Recording says how loud it sounds, and is brought
// to the loudness this page wants for its kind. The lead voice sounds at
// -16 LUFS, the choir keeps its balance beneath it, the Music lies 6 LU
// under the voices; nothing is raised more than 12 dB, nor past -1 dBTP.
// (The same choice the terminal makes; see packages/archive/lib/mix.ts.)
const voiceLoudness = -16
const bedsUnder = 6
const mostRaised = 12
const ceiling = -1
function levelOf({ kind, gain, loudness }) {
  if (!loudness) return gain ?? 1
  const wanted =
    kind === 'voice' ? voiceLoudness + 20 * Math.log10(gain ?? 1) : voiceLoudness - bedsUnder
  const raise = Math.min(mostRaised, wanted - loudness.lufs, ceiling - loudness.peak)
  return 10 ** (raise / 20)
}

// Everything goes out through a gentle limiter, so that the moments when
// the whole choir and the Music swell together are held, not clipped.
let out
function speakers(audioContext) {
  if (!out) {
    out = audioContext.createDynamicsCompressor()
    out.threshold.value = -6
    out.knee.value = 6
    out.ratio.value = 12
    out.attack.value = 0.003
    out.release.value = 0.25
    out.connect(audioContext.destination)
  }
  return out
}

// The voices. Every voice goes to the speakers, and an echo of it follows
// half a second behind, fading. In 2023 only the echo was connected.
let voiceBus
function voices(audioContext) {
  if (!voiceBus) {
    voiceBus = audioContext.createGain()
    const echo = createDelay(audioContext, 0.5, 0.22)
    voiceBus.connect(speakers(audioContext))
    voiceBus.connect(echo.in)
    echo.out.connect(speakers(audioContext))
  }
  return voiceBus
}

// The Music. Each bed lies under its section of the song, at its own
// loudness, without the voices' echo, and lets go softly at its end.
let musicBus
function music(audioContext) {
  if (!musicBus) {
    musicBus = audioContext.createGain()
    musicBus.connect(speakers(audioContext))
  }
  return musicBus
}
const letGoOf = 0.6 // seconds a bed takes to fade at its end

// Where each singer stands, as this page hears them: the lead in the middle,
// the harmonies a little to either side, the way a small choir stands
// around its lead. Every singer is their own Recording, so the page may
// place them as it likes.
const stand = [0, -0.4, 0.4, -0.7]
const standingOf = (voice = 0) => stand[voice] ?? 0

/** How far ahead sounds are placed on the audio clock, in seconds. */
const ahead = 8

/** A take has had one of its moments; after its last, its samples are let go. */
function heardOnce(song, recording) {
  // only the moments that were waited for count: one already over when the page joined does not
  if (!song.heard.has(recording)) return
  const { id } = recording
  const left = (song.uses.get(id) ?? 1) - 1
  song.uses.set(id, left)
  if (left <= 0) song.voices.delete(id)
}

/**
 * Places every sound that begins soon, or began a moment ago and is still
 * going, on the audio clock: at the moment the Tactus says, translated into
 * the audio clock's time just before it is placed, so the two never drift
 * apart for long. A sound already under way is joined where it would be.
 */
function placeSounds(audioContext) {
  for (const song of songs.values()) {
    if (!song.startable) continue
    const { begins } = song.airing
    song.placed ??= new Set()
    song.session.recordings.forEach((recording, n) => {
      if (song.placed.has(n)) return
      const starts = begins + recording.at * 1000
      const until = (starts - now()) / 1000
      if (until > ahead) return
      // a line whose place is already over is not decoded at all
      if (recording.seconds !== undefined && until + recording.seconds + (recording.fade ?? 0) <= 0) {
        song.placed.add(n)
        if (recording.take) heardOnce(song, recording)
        return
      }
      let buffering
      if (recording.take) {
        // a take the page sang: its samples become a sound, and are let go once heard for the last time
        const samples = song.voices.get(recording.id)
        if (!samples) return
        song.placed.add(n)
        const buffer = audioContext.createBuffer(1, samples.length, throatRate)
        buffer.copyToChannel(samples, 0)
        heardOnce(song, recording)
        buffering = Promise.resolve(buffer)
      } else {
        const data = song.files.get(recording.id)
        if (!data) return
        song.placed.add(n)
        // decoding takes the data away, so a copy is decoded
        buffering = audioContext.decodeAudioData(data.slice(0))
      }
      buffering.then((buffer) => {
        const since = (now() - starts) / 1000
        if (since >= buffer.duration) return
        const when = audioContext.currentTime - since
        const source = audioContext.createBufferSource()
        source.buffer = buffer
        let stopAt
        if (recording.kind === 'bed') {
          const level = audioContext.createGain()
          const gain = levelOf(recording)
          level.gain.value = gain
          // a bed with a tail is held through its place, then fades out under
          // what follows, which has already begun; one without lets go softly at its end
          const fade = recording.fade && recording.seconds !== undefined ? recording.fade : letGoOf
          const fades = recording.fade && recording.seconds !== undefined
            ? when + recording.seconds
            : when + buffer.duration - letGoOf
          const ends = Math.min(when + buffer.duration, fades + fade)
          const now = audioContext.currentTime
          if (fades > now) level.gain.setValueAtTime(gain, fades)
          else level.gain.value = Math.max(0, gain * (1 - (now - fades) / fade))
          level.gain.linearRampToValueAtTime(0, Math.max(now, ends))
          stopAt = Math.max(now, ends) + 0.05
          level.connect(music(audioContext))
          source.connect(level)
        } else {
          const level = audioContext.createGain()
          level.gain.value = levelOf(recording)
          const place = audioContext.createStereoPanner()
          place.pan.value = standingOf(recording.voice)
          source.connect(level).connect(place).connect(voices(audioContext))
        }
        if (since > 0) source.start(audioContext.currentTime, since)
        else source.start(when)
        if (stopAt !== undefined) source.stop(stopAt)
      })
    })
  }
}

// The words. Every part of the song is its own paragraph, and the words are
// only ever added as text: whatever the mind writes is shown, never obeyed.
//
// The page keeps the words of the last few iterations only. A listener may
// leave it open for weeks, and a page that kept every word ever sung would
// grow heavy and slow; what has gone can be looked back on.
const keptIterations = 12
function turnPage(output) {
  const turn = document.createElement('span')
  turn.className = 'turn'
  turn.hidden = true
  output.appendChild(turn)
  const turns = output.querySelectorAll('.turn')
  if (turns.length <= keptIterations) return
  const oldest = turns[turns.length - keptIterations]
  while (output.firstChild && output.firstChild !== oldest) {
    output.removeChild(output.firstChild)
  }
}
let el
function switchStoryElement(parent, kind = 'verse', lines = []) {
  el = document.createElement('p')
  el.className = kind
  parent.appendChild(el)
  if (lines.length) {
    // every line is known before it is typed, so where the rows break is
    // known too, and the page does not jump as the words arrive
    el.lines = lines.map((line) => line.text)
    setLines(el)
  }
}
function appendStoryElement(text) {
  const last = el.lastChild
  if (last && last.nodeType === Node.TEXT_NODE) last.appendData(text)
  else el.appendChild(document.createTextNode(text))
}
/**
 * The end of a line: a seam, which either ends its row or, where the line
 * wrapped and left its last row short, lets the next line run on after it.
 */
function breakLine() {
  const seam = document.createElement('span')
  seam.className = 'seam'
  seam.textContent = ' '
  el.appendChild(seam)
  setSeam(el, el.querySelectorAll('.seam').length - 1, seam)
}
function setSeam(paragraph, index, seam) {
  seam.classList.toggle('run', paragraph.breaks?.[index] === false)
}

// Where each line of a paragraph ends its row, measured in the page's own
// letters (verses.js) rather than by laying the page out to see. Without the
// measure every line is a row of its own, as it always was.
/** The extra room a line running on is set after the one before, in em; as `.seam.run` sets it. */
const runOn = 0.6
function setLines(paragraph) {
  if (!paragraph.lines || !globalThis.verses) return
  const style = getComputedStyle(paragraph)
  const width = paragraph.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  if (width <= 0) return
  const size = parseFloat(style.fontSize)
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  paragraph.breaks = verses.breaks(paragraph.lines, font, width, runOn * size)
  paragraph.querySelectorAll('.seam').forEach((seam, i) => setSeam(paragraph, i, seam))
}
function setAllLines() {
  document.querySelectorAll('#output p').forEach(setLines)
}
// the page's width changes, and its letters arrive after the first words may have
let settingLines = 0
addEventListener('resize', () => {
  cancelAnimationFrame(settingLines)
  settingLines = requestAnimationFrame(setAllLines)
})
document.fonts?.addEventListener('loadingdone', () => {
  globalThis.verses?.forget()
  setAllLines()
})
function weather(output, words) {
  bridgeEnds()
  switchStoryElement(output, 'weather')
  appendStoryElement(`~ ${words} ~`)
}

/**
 * Where the page has reached in a Song's words: which iteration, part and
 * line, and how many characters of it are shown. It only ever moves
 * forward, to wherever the Tactus says the song has reached.
 */
function writeUpTo(output, song, t) {
  const { session } = song
  if (!song.cursor) {
    // a new Song clears the page: only the one being received is shown.
    // A listener who arrives late begins with the weather, then the
    // iteration being sung, its words so far shown at once
    output.replaceChildren()
    weather(output, session.mood.join(' + '))
    const current = Math.max(0, session.iterations.findLastIndex((it) => it.at <= t))
    song.cursor = { i: current, p: -1, l: 0, c: 0 }
  }
  const cursor = song.cursor
  for (;;) {
    const iteration = session.iterations[cursor.i]
    if (!iteration) return
    if (cursor.p < 0) {
      if (t < iteration.at) return
      turnPage(output)
      describe(session, iteration)
      cursor.p = 0
      cursor.l = 0
      cursor.c = -1
    }
    const part = iteration.parts[cursor.p]
    if (!part) {
      cursor.i++
      cursor.p = -1
      continue
    }
    if (cursor.c < 0) {
      if (t < part.at) return
      bridgeEnds()
      switchStoryElement(output, part.type, part.lines)
      if (part.type === 'bridge' && t < part.at + part.seconds) bridgeBegins(el)
      cursor.c = 0
    }
    const line = part.lines[cursor.l]
    if (!line) {
      cursor.p++
      cursor.l = 0
      cursor.c = -1
      continue
    }
    // characters, each at its moment; the last moment is the line's end
    const since = (t - line.at) * 1000
    while (cursor.c < line.text.length && line.typing[cursor.c] <= since) {
      appendStoryElement(line.text[cursor.c])
      cursor.c++
    }
    if (cursor.c < line.text.length || line.typing[line.text.length] > since) return
    breakLine()
    cursor.l++
    cursor.c = 0
  }
}

// A quiet line at the edge of the page: the Song, and its iteration as a
// side note. Everything else the receiver knows is behind the knob.
const number = (n) => BigInt(n).toLocaleString('en')
const span = (className, textContent) => Object.assign(document.createElement('span'), { className, textContent })
let showing // what is being received: a Session, and the iteration of it

function describe(session, iteration) {
  if (showing?.session !== session) window.space?.tune(session.song)
  showing = { session, iteration }
  document.getElementById('status').replaceChildren(
    span('song', `Song ${number(session.song)}`),
    span('side', ` · iteration ${number(iteration.iteration)}`),
  )
  tellDetails()
}

/** What the status line says while nothing is being sung. */
function waiting(words) {
  document.getElementById('status').replaceChildren(document.createTextNode(words))
}

function row(name, value) {
  const both = document.createDocumentFragment()
  both.append(
    Object.assign(document.createElement('dt'), { textContent: name }),
    Object.assign(document.createElement('dd'), { textContent: value }),
  )
  return both
}

/** What the mind thought of the Song being shown, beneath what is known of it: nothing, if it kept no thought. */
function tellThought(thought) {
  const figure = document.getElementById('thought')
  figure.querySelector('p').textContent = thought ?? ''
  figure.hidden = !thought
}

function tellDetails() {
  const details = document.getElementById('details')
  if (!showing) {
    details.replaceChildren(row('receiving', replay ? `Song ${replay.number}, soon` : 'nothing yet'))
    tellThought(undefined)
    return
  }
  const { session, iteration } = showing
  details.replaceChildren(
    row('song', `${number(session.song)}${replay ? ', from its beginning' : ', live'}`),
    row('weather', session.mood.join(' + ')),
    row('key', `${session.mode}, ${session.tempo} bpm`),
    row('choir', session.choir),
    ...(session.sound ? [row('band', session.sound)] : []),
    // the ways this Song is heard differently from the usual, if any
    ...(session.perspectives?.length
      ? [row('heard', session.perspectives.map(({ title, variant }) => (variant ? `${title}: ${variant}` : title)).join(', '))]
      : []),
    row('iteration', `${number(iteration.iteration)}, ${iteration.of.at} of ${iteration.of.of}`),
  )
  tellThought(session.thought)
}

// Bridges. A bridge has no words, so while the music carries the song
// across, the page draws one line of its own: whichever of these it likes,
// chosen afresh for every bridge. When the next part begins, the line
// settles into a quiet ~. A listener who would rather nothing moved is
// shown the ~ alone.
const width = 24
const pingPong = (t, span) => {
  const p = t % (2 * span)
  return p < span ? p : 2 * span - p
}
const motions = [
  // the tide
  (t) =>
    Array.from({ length: width }, (_, i) => "_.-~'~-."[(i + t) % 8]).join(''),
  // a stone skipping across, and back
  (t) => {
    const at = pingPong(t, width - 1)
    return Array.from({ length: width }, (_, i) =>
      i === at ? 'o' : Math.abs(i - at) < 3 ? '.' : ' ',
    ).join('')
  },
  // a breath, in and out
  (t) => {
    const half = Math.round((Math.sin(t / 4) + 1) * ((width / 2 - 2) / 2))
    const breath = `(${' '.repeat(half * 2)})`
    return breath.padStart((width + breath.length) / 2, ' ')
  },
  // stars, coming and going
  (t) =>
    Array.from({ length: width }, (_, i) => {
      const n = Math.sin(i * 12.9898 + Math.floor(t / 3) * 78.233) * 43758.5453
      const twinkle = n - Math.floor(n)
      return twinkle > 0.85 ? '*' : twinkle > 0.7 ? '+' : twinkle > 0.5 ? '.' : ' '
    }).join(''),
  // a pendulum, slow
  (t) => {
    const at = Math.round(((Math.sin(t / 5) + 1) / 2) * (width - 1))
    return Array.from({ length: width }, (_, i) =>
      i === at ? '|' : i === width / 2 ? ':' : ' ',
    ).join('')
  },
]
const still = '~'
const stillness = window.matchMedia('(prefers-reduced-motion: reduce)')
let motion
function bridgeBegins(paragraph) {
  bridgeEnds()
  const line = document.createElement('span')
  line.className = 'motion'
  paragraph.appendChild(line)
  if (stillness.matches) {
    line.textContent = still
    return
  }
  const draw = motions[Math.floor(Math.random() * motions.length)]
  let t = 0
  line.textContent = draw(t)
  motion = { line, timer: setInterval(() => (line.textContent = draw(++t)), 140) }
}
function bridgeEnds() {
  if (!motion) return
  clearInterval(motion.timer)
  motion.line.textContent = still
  motion = undefined
}

// The Songs. Every Song received is in the Archive, with its words; anyone
// may leaf back through them, newest first, and tune to any one of them from
// its beginning, at /s/<its number>. The Radio hands them out a page at a
// time; the dialog is a window onto them, showing only the rows that fit,
// and is moved, never scrolled: by the wheel, a finger, the keys, or the
// buttons at its corners. The page in view is fetched, and the one after it.
const rowPx = 52
const received = { total: undefined, rows: [], asked: new Set(), at: 0 }
let firstShown = 0 // the first row in the window

/** How many rows fit in the window, from the dialog's height. */
const pageRows = () => Math.max(3, Math.floor((Math.min(640, innerHeight - 64) - 72) / rowPx))

async function loadPage(page) {
  const size = pageRows()
  if (page < 0 || (received.total !== undefined && page * size >= received.total)) return
  const key = `${size}:${page}`
  if (received.asked.has(key)) return
  received.asked.add(key)
  try {
    const found = await fetch(`${radio}/songs/page?offset=${page * size}&count=${size}`).then((r) => r.json())
    received.total = found.total
    found.songs.forEach((song, i) => (received.rows[found.offset + i] = song))
    drawSongs()
  } catch {
    received.asked.delete(key) // asked again when it next comes into view
  }
}

/** Forgets what was fetched, when it is old enough that new Songs have moved every row down. */
function freshen() {
  if (Date.now() - received.at < 60_000) return
  Object.assign(received, { total: undefined, rows: [], asked: new Set(), at: Date.now() })
}

function songRow(song, index) {
  const item = document.createElement('li')
  if (!song) {
    item.className = 'unknown'
    item.textContent = '…'
    return item
  }
  // the latest Song is not looked back on: it is where the receiver tunes in live
  const latest = index === 0
  const link = Object.assign(document.createElement('a'), { href: latest ? '/' : `/s/${song.song}` })
  link.append(document.createTextNode(latest ? 'tune live' : `Song ${number(song.song)}`))
  const about = song.mood ? `${song.mood.join(' + ')} · ${Math.round(song.seconds / 60)} min` : '…'
  link.append(span('mood', latest ? `Song ${number(song.song)} · ${about}` : about))
  item.append(link)
  return item
}

function drawSongs() {
  if (!songsDialog.open) return
  const size = pageRows()
  const total = received.total ?? 0
  const list = document.getElementById('song-list')
  document.getElementById('song-window').style.height = `${size * rowPx}px`
  firstShown = Math.max(0, Math.min(firstShown, Math.max(0, total - size)))
  if (received.total === 0) {
    list.replaceChildren(Object.assign(document.createElement('li'), { className: 'unknown', textContent: 'nothing received yet' }))
  } else {
    const shown = Math.min(size, received.total === undefined ? size : total - firstShown)
    list.replaceChildren(...Array.from({ length: shown }, (_, i) => songRow(received.rows[firstShown + i], firstShown + i)))
  }
  document.getElementById('page-up').disabled = firstShown === 0
  document.getElementById('page-down').disabled = firstShown + size >= total
  // the pages in view, and the one after
  const first = Math.floor(firstShown / size)
  const last = Math.floor((firstShown + size - 1) / size)
  for (let page = first; page <= last + 1; page++) loadPage(page)
}

function moveSongs(rows) {
  if (!rows) return
  firstShown += rows
  drawSongs()
}

const songWindow = document.getElementById('song-window')
let wheeled = 0
songWindow.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
    wheeled += event.deltaMode === 1 ? event.deltaY * rowPx : event.deltaY
    const rows = Math.trunc(wheeled / rowPx)
    wheeled -= rows * rowPx
    moveSongs(rows)
  },
  { passive: false },
)
let touched
songWindow.addEventListener('touchstart', (event) => (touched = event.touches[0].clientY), { passive: true })
songWindow.addEventListener(
  'touchmove',
  (event) => {
    if (touched === undefined) return
    event.preventDefault()
    const rows = Math.trunc((touched - event.touches[0].clientY) / rowPx)
    if (!rows) return
    touched -= rows * rowPx
    moveSongs(rows)
  },
  { passive: false },
)
songWindow.addEventListener('touchend', () => (touched = undefined))
document.getElementById('page-up').addEventListener('click', () => moveSongs(-pageRows()))
document.getElementById('page-down').addEventListener('click', () => moveSongs(pageRows()))
document.getElementById('songs').addEventListener('keydown', (event) => {
  const moves = {
    ArrowDown: 1,
    ArrowUp: -1,
    PageDown: pageRows(),
    PageUp: -pageRows(),
    Home: -Infinity,
    End: Infinity,
  }
  if (!(event.key in moves)) return
  event.preventDefault()
  const by = moves[event.key]
  if (by === -Infinity) firstShown = 0
  else if (by === Infinity) firstShown = received.total ?? 0
  else firstShown += by
  drawSongs()
})
addEventListener('resize', () => drawSongs())

const knob = document.getElementById('knob')
const panel = document.getElementById('panel')
const songsDialog = document.getElementById('songs')
function showPanel(shown) {
  panel.hidden = !shown
  knob.setAttribute('aria-expanded', String(shown))
  if (shown) tellDetails()
}
knob.addEventListener('click', () => showPanel(panel.hidden))
document.addEventListener('click', (event) => {
  if (!panel.hidden && !panel.contains(event.target) && !knob.contains(event.target)) showPanel(false)
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') showPanel(false)
})
document.getElementById('open-songs').addEventListener('click', () => {
  showPanel(false)
  freshen()
  firstShown = 0
  songsDialog.showModal()
  drawSongs()
})
document.getElementById('close-songs').addEventListener('click', () => songsDialog.close())

// A Song asked for by its number, at /s/<n>, is played from its beginning.
const asked = /^\/s\/(\d{1,400})\/?$/.exec(location.pathname)
const replay = asked && BigInt(asked[1]) > 0n ? { index: BigInt(asked[1]), number: BigInt(asked[1]).toLocaleString('en') } : undefined
if (replay) {
  document.getElementById('play').textContent = `play Song ${replay.number} from its beginning`
  document.getElementById('live').hidden = false
}

async function listenAgain(output, audioContext) {
  const song = String(replay.index)
  let tactus
  try {
    tactus = await askRadio()
  } catch {
    weather(output, 'the radio is quiet')
    return
  }
  // only what has been received may be heard again: nothing from the future
  const aired =
    tactus.playing?.song === song ||
    (await fetch(`${radio}/songs?before=${replay.index + 1n}&count=1`)
      .then((r) => r.json())
      .then((found) => found.some((a) => a.song === song))
      .catch(() => false))
  if (!aired) {
    weather(output, `Song ${replay.number} has not been received yet`)
    waiting('tune to live from the knob')
    return
  }
  const airing = { song, session: new URL(`sessions/${song}.json`, tactus.archive).href, archive: tactus.archive, begins: Infinity, seconds: 0 }
  const prepared = prepare(airing)
  const fetching = setInterval(
    () => waiting(`readying Song ${replay.number}: ${prepared.fetched} of ${prepared.first || '…'} to begin with`),
    200,
  )
  await prepared.starting
  clearInterval(fetching)
  if (!prepared.startable) {
    weather(output, `Song ${replay.number} cannot be found in the Archive`)
    return
  }
  airing.seconds = prepared.session.seconds
  airing.begins = now() + 1500
  let ended = false
  setInterval(() => {
    placeSounds(audioContext)
    singSoon()
    const t = (now() - airing.begins) / 1000
    if (t < 0) return waiting(`Song ${replay.number} begins in ${Math.ceil(-t)}s`)
    if (t < airing.seconds) {
      writeUpTo(output, prepared, t)
      if (prepared.missing && t < 6) waiting('its voices were lost; only its words remain')
      return
    }
    if (ended) return
    ended = true
    bridgeEnds()
    weather(output, `Song ${replay.number} has ended`)
    waiting('tune to live from the knob')
  }, 50)
}

// Listening, for as long as the page is open. Every few seconds the Radio is
// asked what plays and what comes; many times a second, the page catches up
// with the Tactus. If the Radio cannot be reached, the page goes on with
// what it already has, and asks again.
const quiet = '~ the radio is quiet ~'
const breath = '~ the song holds its breath ~'

async function listen() {
  document.getElementById('controls').style.display = 'none'
  const output = document.getElementById('output')
  const audioContext = new AudioContext()
  // the first page of Songs comes with the first Song, so the dialog opens full
  received.at = Date.now()
  loadPage(0)
  if (replay) return listenAgain(output, audioContext)
  let said // the last thing said into the quiet, so it is said only once
  let heard = false

  const ask = async () => {
    try {
      const tactus = await askRadio()
      heard = true
      for (const airing of [tactus.playing, tactus.next]) if (airing) prepare(airing)
      forget()
    } catch {
      if (said !== quiet) weather(output, quiet.slice(2, -2))
      said = quiet
    }
  }
  await ask()
  setInterval(ask, 5000)

  setInterval(() => {
    placeSounds(audioContext)
    singSoon()
    const moment = now()
    const playing = [...songs.values()].find(
      ({ airing }) => airing.begins <= moment && moment < airing.begins + airing.seconds * 1000,
    )
    if (playing?.startable) {
      said = undefined
      writeUpTo(output, playing, (moment - playing.airing.begins) / 1000)
    } else if (playing) {
      // arrived in the middle of a Song that is not yet fetched: it is joined when it is
      waiting(`readying the Song being sung: ${playing.fetched} of ${playing.first || '…'} to begin with`)
    } else if (heard) {
      bridgeEnds()
      const coming = [...songs.values()].find(({ airing }) => airing.begins > moment)
      if (coming) {
        const inSeconds = Math.ceil((coming.airing.begins - moment) / 1000)
        waiting(
          coming.startable
            ? `the next Song begins in ${inSeconds}s`
            : `readying the next Song: ${coming.fetched} of ${coming.first || '…'} to begin with`,
        )
      } else if (said !== breath) {
        weather(output, breath.slice(2, -2))
        said = breath
        waiting('waiting for the next Song')
      }
    }
  }, 50)
}

document.getElementById('play').addEventListener('click', () => listen())
