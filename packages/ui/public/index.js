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

// The Songs this page knows: each fetched whole, Session and Recordings,
// before it begins.
const songs = new Map()

/** How many Recordings are fetched at once. */
const fetching = 6

function prepare(airing) {
  if (songs.has(airing.song)) return songs.get(airing.song)
  const song = { airing, session: undefined, files: new Map(), ready: false, fetched: 0, needed: 0 }
  songs.set(airing.song, song)
  song.preparing = (async () => {
    song.session = await fetch(airing.session).then((r) => r.json())
    const ids = [...new Set(song.session.recordings.map(({ id }) => id))]
    song.needed = ids.length
    const queue = [...ids]
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()
        for (let attempt = 0; ; attempt++) {
          try {
            const url = new URL(`recordings/${id}`, airing.archive)
            const data = await fetch(url).then((r) => {
              if (!r.ok) throw new Error(`${r.status}`)
              return r.arrayBuffer()
            })
            song.files.set(id, data)
            song.fetched++
            break
          } catch {
            // the Archive is busy, or the way to it; ask again, a little later
            await new Promise((resolve) => setTimeout(resolve, Math.min(10_000, 500 * 2 ** attempt)))
          }
        }
      }
    }
    await Promise.all(Array.from({ length: fetching }, worker))
    song.ready = true
  })().catch(() => {
    // a Session that cannot be read is forgotten, and asked for again
    songs.delete(airing.song)
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


// The voices. Every voice goes to the speakers, and an echo of it follows
// half a second behind, fading. In 2023 only the echo was connected.
let voiceBus
function voices(audioContext) {
  if (!voiceBus) {
    voiceBus = audioContext.createGain()
    const echo = createDelay(audioContext, 0.5, 0.22)
    voiceBus.connect(audioContext.destination)
    voiceBus.connect(echo.in)
    echo.out.connect(audioContext.destination)
  }
  return voiceBus
}

// The Music. Each bed lies under its section of the song, at its own
// loudness, without the voices' echo, and lets go softly at its end.
let musicBus
function music(audioContext) {
  if (!musicBus) {
    musicBus = audioContext.createGain()
    musicBus.connect(audioContext.destination)
  }
  return musicBus
}
const letGoOf = 0.6 // seconds a bed takes to fade at its end

/** How far ahead sounds are placed on the audio clock, in seconds. */
const ahead = 8

/**
 * Places every sound that begins soon, or began a moment ago and is still
 * going, on the audio clock: at the moment the Tactus says, translated into
 * the audio clock's time just before it is placed, so the two never drift
 * apart for long. A sound already under way is joined where it would be.
 */
function placeSounds(audioContext) {
  for (const song of songs.values()) {
    if (!song.ready) continue
    const { begins } = song.airing
    song.placed ??= new Set()
    song.session.recordings.forEach((recording, n) => {
      if (song.placed.has(n)) return
      const starts = begins + recording.at * 1000
      const until = (starts - now()) / 1000
      if (until > ahead) return
      // a line whose place is already over is not decoded at all
      if (recording.seconds !== undefined && until + recording.seconds <= 0) {
        song.placed.add(n)
        return
      }
      const data = song.files.get(recording.id)
      if (!data) return
      song.placed.add(n)
      // decoding takes the data away, so a copy is decoded
      audioContext.decodeAudioData(data.slice(0)).then((buffer) => {
        const since = (now() - starts) / 1000
        if (since >= buffer.duration) return
        const when = audioContext.currentTime - since
        const source = audioContext.createBufferSource()
        source.buffer = buffer
        if (recording.kind === 'bed') {
          const level = audioContext.createGain()
          const gain = recording.gain ?? 1
          level.gain.value = gain
          const ends = when + buffer.duration
          level.gain.setValueAtTime(gain, Math.max(audioContext.currentTime, ends - letGoOf))
          level.gain.linearRampToValueAtTime(0, Math.max(audioContext.currentTime, ends))
          level.connect(music(audioContext))
          source.connect(level)
        } else {
          source.connect(voices(audioContext))
        }
        if (since > 0) source.start(audioContext.currentTime, since)
        else source.start(when)
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
function switchStoryElement(parent, kind = 'verse') {
  el = document.createElement('p')
  el.className = kind
  parent.appendChild(el)
}
function appendStoryElement(text) {
  const last = el.lastChild
  if (last && last.nodeType === Node.TEXT_NODE) last.appendData(text)
  else el.appendChild(document.createTextNode(text))
}
function breakLine() {
  el.appendChild(document.createElement('br'))
}
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
    // a listener who arrives late begins with the weather, then the
    // iteration being sung, its words so far shown at once
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
      switchStoryElement(output, part.type)
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

// A quiet line at the edge of the page: how old the song is, and what it is.
function describe(session, iteration) {
  const status = document.getElementById('status')
  const age = (BigInt(iteration.iteration) + 1n).toLocaleString('en')
  status.replaceChildren(
    Object.assign(document.createElement('span'), {
      className: 'age',
      textContent: `iteration ${age}`,
    }),
    document.createTextNode(
      ` · ${iteration.of.at} of ${iteration.of.of} · ${session.mood.join(' + ')} · ${session.mode}, ${session.tempo} bpm · ${session.choir}`,
    ),
  )
  const sound = session.sound ? ` · ${session.sound}` : ''
  status.title = `song ${(BigInt(session.song) + 1n).toLocaleString('en')}, ${iteration.of.at} of ${iteration.of.of} · variation ${iteration.variation + 1}${sound}`
}

/** What the status line says while nothing is being sung. */
function waiting(words) {
  const status = document.getElementById('status')
  status.replaceChildren(document.createTextNode(words))
  status.title = ''
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

// Looking back. Every Song that has aired is in the Archive, with its words;
// anyone may leaf back through them, a few Songs at a time, newest first.
const songsPerPage = 3

function textParagraph(kind, lines) {
  const p = document.createElement('p')
  p.className = kind
  lines.forEach((line, i) => {
    if (i > 0) p.appendChild(document.createElement('br'))
    p.appendChild(document.createTextNode(line))
  })
  return p
}

function renderSong(session) {
  const article = document.createElement('article')
  const heading = document.createElement('h2')
  heading.textContent = `song ${(BigInt(session.song) + 1n).toLocaleString('en')}`
  const details = [
    session.mood.join(' + '),
    `${session.mode}, ${session.tempo} bpm`,
    session.choir,
    session.sound,
  ].filter(Boolean)
  article.append(heading, textParagraph('weather', [details.join(' · ')]))
  for (const iteration of [...session.iterations].reverse()) {
    const title = document.createElement('h3')
    title.textContent = `iteration ${(BigInt(iteration.iteration) + 1n).toLocaleString('en')}`
    article.appendChild(title)
    for (const part of iteration.parts) {
      if (part.type === 'bridge') continue
      article.appendChild(textParagraph(part.type, part.lines.map(({ text }) => text)))
    }
  }
  return article
}

async function leafBack(before) {
  const pages = document.getElementById('pages')
  const older = document.getElementById('older')
  older.hidden = true
  const query = before ? `?before=${before}&count=${songsPerPage}` : `?count=${songsPerPage}`
  try {
    const found = await fetch(`${radio}/songs${query}`).then((r) => r.json())
    if (!before && found.length === 0) {
      pages.appendChild(textParagraph('weather', ['nothing has been sung to the end yet']))
    }
    for (const airing of found) {
      const session = await fetch(airing.session).then((r) => (r.ok ? r.json() : undefined))
      if (session) pages.appendChild(renderSong(session))
    }
    if (found.length === songsPerPage) {
      older.hidden = false
      older.onclick = () => leafBack(found.at(-1).song)
    }
  } catch {
    pages.appendChild(textParagraph('weather', ['~ the Archive cannot be reached ~']))
  }
}

function openDiary() {
  document.getElementById('pages').replaceChildren()
  document.getElementById('diary').hidden = false
  document.body.classList.add('looking-back')
  leafBack()
}

function closeDiary() {
  document.getElementById('diary').hidden = true
  document.body.classList.remove('looking-back')
}

document.getElementById('look-back').addEventListener('click', openDiary)
document.getElementById('close-diary').addEventListener('click', closeDiary)
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDiary()
})

let isScrolling = false
window.addEventListener('scroll', () => {
  isScrolling = true
  setTimeout(() => {
    isScrolling = false
  }, 3000)
})

const shouldFollowStory = (threshold = 100) => {
  const el = document.scrollingElement
  const scrollSize = Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop)
  return !isScrolling && scrollSize < threshold
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
    const moment = now()
    const playing = [...songs.values()].find(
      ({ airing }) => airing.begins <= moment && moment < airing.begins + airing.seconds * 1000,
    )
    if (playing?.ready) {
      said = undefined
      writeUpTo(output, playing, (moment - playing.airing.begins) / 1000)
    } else if (playing) {
      // arrived in the middle of a Song that is not yet fetched: it is joined when it is
      waiting(`fetching the Song being sung: ${playing.fetched} of ${playing.needed || '…'} recordings`)
    } else if (heard) {
      bridgeEnds()
      const coming = [...songs.values()].find(({ airing }) => airing.begins > moment)
      if (coming) {
        const inSeconds = Math.ceil((coming.airing.begins - moment) / 1000)
        waiting(
          coming.ready
            ? `the next Song begins in ${inSeconds}s`
            : `fetching the next Song: ${coming.fetched} of ${coming.needed || '…'} recordings`,
        )
      } else if (said !== breath) {
        weather(output, breath.slice(2, -2))
        said = breath
        waiting('waiting for the next Song')
      }
    }
    if (shouldFollowStory()) document.getElementById('end').scrollIntoView()
  }, 50)
}

document.getElementById('play').addEventListener('click', () => listen())
