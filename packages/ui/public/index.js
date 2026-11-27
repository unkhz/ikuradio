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
  noticeVersions(tactus)
  return tactus
}

// Keeping up (plan "The Receiver updates itself"). The Tactus tells two
// versions with everything it says: the Radio's release, and the Archive's.
// A page that sees either move queues an update, and takes it at the one
// moment the song can spare: when the Song it was playing has ended. A Song
// is never cut short, and no next Song is begun until the update is done.
const running = document.querySelector('meta[name="release"]')?.content
let seenArchive
const queued = { radio: false, archive: false, ready: true }
let holdUntil = 0 // when the Song that was playing as the update was queued ends, in the Radio's time

/** The Song playing now, if one is: from the Songs this page knows. */
function playingNow() {
  const moment = now()
  return [...songs.values()].find(({ airing }) => airing.begins <= moment && moment < airing.begins + airing.seconds * 1000)
}

function noticeVersions({ release, archiveVersion }) {
  const wasQueued = queued.radio || queued.archive
  if (release && running && release !== running && !queued.radio && reloadedFor() !== release) {
    queued.radio = true
    queued.ready = false
    prepareReload()
  }
  if (archiveVersion) {
    if (seenArchive !== undefined && archiveVersion !== seenArchive) queued.archive = true
    seenArchive = archiveVersion
  }
  if (!wasQueued && (queued.radio || queued.archive)) {
    const playing = playingNow()
    holdUntil = playing ? playing.airing.begins + playing.airing.seconds * 1000 : 0
  }
}

/** Whether this page was reloaded to be updated while someone listened (a minute ago at most): it is, once, and then it is not. */
function takeResume() {
  try {
    const at = Number(sessionStorage.getItem('ikuradio:resume'))
    sessionStorage.removeItem('ikuradio:resume')
    return at > 0 && Date.now() - at < 60_000
  } catch {
    return false
  }
}

/** The release this page last reloaded for, so a Radio that keeps telling an old one does not send it round and round. */
function reloadedFor() {
  try {
    return sessionStorage.getItem('ikuradio:reloaded')
  } catch {
    return null
  }
}

/** While the Song plays: the new index is fetched quietly, and the files it names, so what changed is here when the reload comes. */
function prepareReload() {
  ;(async () => {
    const index = await fetch(location.pathname, { cache: 'no-cache' }).then((r) => r.text())
    const named = [...index.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1])
    await Promise.all(named.map((file) => fetch(file).then((r) => r.arrayBuffer())))
  })()
    .catch(() => {})
    .finally(() => {
      queued.ready = true
    })
}

/** Whether an update is queued and the Song it waited for has stopped. */
function updateDue() {
  return (queued.radio || queued.archive) && now() >= holdUntil
}

/**
 * Takes the update queued, when its moment has come. The Archive's: what was
 * never heard is let go, so the Songs are fetched afresh. The Radio's: the
 * page reloads, as a first visit does, and only the files whose hashes
 * changed are fetched. Returns whether this moment is spent on it.
 */
function takeUpdate(then) {
  if (!updateDue()) return false
  if (queued.archive) {
    queued.archive = false
    songs.clear()
    then?.()
  }
  if (queued.radio) {
    if (!queued.ready) return true
    reloadForUpdate()
    return true
  }
  return true
}

let reloading = false
async function reloadForUpdate() {
  if (reloading) return
  reloading = true
  try {
    const { release } = await fetch(`${radio}/tactus`, { cache: 'no-store' }).then((r) => r.json())
    sessionStorage.setItem('ikuradio:reloaded', release)
  } catch {}
  // the page that comes back carries on listening by itself, where the listener was: not the front page, waiting for a click
  try {
    sessionStorage.setItem('ikuradio:resume', String(Date.now()))
  } catch {}
  location.reload()
}

// The Songs this page knows. Each is fetched in the order it will be
// heard, from wherever the listener joins it; it may begin once the
// Recordings of its first stretch are here, and the rest follow behind.
const songs = new Map()
/**
 * A Song's place in `songs`: its number and its beginning when it was
 * prepared. An encore sings a Song again, and the one that has ended is not
 * the one that begins. It is kept on the Song, for a Song heard again is
 * given its beginning only after it is prepared.
 */
const placeOf = (airing) => (airing.slot !== undefined ? `${airing.song}#${airing.slot}` : `${airing.song}@${airing.begins}`)

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
  // a Song with an intro, not yet begun, begins when the intro has played
  const begins = Number.isFinite(song.airing.begins) ? song.airing.begins : now() + (song.intro?.seconds ?? 0) * 1000
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
  const body = recording.body ?? song.session.singers?.[recording.voice ?? 0]?.body ?? 'female'
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
    (t) => songs.get(t.song.place) === t.song && dueOf(t) + t.seconds * 1000 > moment,
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
    } else if (songs.get(take.song.place) === take.song) {
      take.song.voices.set(take.id, samples)
      take.song.fetched++
      take.song.done?.()
    }
  }
  singSoon()
}


// The intro (plan "Intro with Rezzy"). A Song made with one has four bars of
// music before its moment 0, and a DJ may speak over them. It is heard only
// by a visit: the page whose first entry is the Song's own. The intro lies
// before the Song's beginning, so everything else keeps its place; here it is
// only added to what the page will place, with the DJ's speech, if the Archive
// keeps one, sung by the page's own throat and moved by the DJ's own movements
// (dj.js: what a DJ sounds and looks like is the same for every Song).

// The speaking throat, apart from the choir's: Chimera's Speak mode, built
// from its own pinned revision (speech.js, throat/speech/), in a Worker of its
// own, opened only when a DJ has something to say. It never sings.
const speaking = { opened: undefined, jobs: new Map(), next: 0 }

function openSpeaking() {
  speaking.opened ??= (async () => {
    const [engine, dictionary] = await Promise.all([
      fetch('/throat/speech/chimera.wasm').then((r) => {
        if (!r.ok) throw new Error(`the speaking throat: ${r.status}`)
        return r.arrayBuffer()
      }),
      fetch('/throat/speech/cmudict.txt.gz').then(async (r) => {
        if (!r.ok) throw new Error(`the speaking dictionary: ${r.status}`)
        return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text()
      }),
    ])
    const worker = new Worker('/speech-worker.js', { type: 'module' })
    const answer = await new Promise((resolve) => {
      worker.onmessage = ({ data }) => resolve(data)
      worker.onerror = (error) => resolve({ opened: false, error: String(error.message ?? error) })
      worker.postMessage({ open: { engine, dictionary } })
    })
    if (!answer.opened) throw new Error(answer.error)
    worker.onmessage = ({ data }) => {
      const job = speaking.jobs.get(data.job)
      speaking.jobs.delete(data.job)
      if (job) data.error ? job.reject(new Error(data.error)) : job.resolve(data)
    }
    return worker
  })()
  return speaking.opened
}

/** Says a request with the speaking throat: its samples, when the speech ends, and each sound it says and when. */
async function say(request) {
  const worker = await openSpeaking()
  return new Promise((resolve, reject) => {
    const job = speaking.next++
    speaking.jobs.set(job, { resolve, reject })
    worker.postMessage({ job, say: request })
  })
}

/** The recordings of a Song's intro: its music, and a DJ's speech if there is one; none if it has no intro. Sets `song.intro`. */
async function introOf(song, airing) {
  // an intro is made after its Song has aired, and kept beside the Session; the Songs
  // made while intros were still made with their Songs have theirs inside it
  const intro =
    song.session.intro ??
    (await fetch(new URL(`sessions/intro-${airing.song}.json`, airing.archive))
      .then((r) => (r.ok ? r.json() : undefined))
      .catch(() => undefined))
  if (!intro) return []
  const recordings = [{ ...intro.recording, kind: 'bed', intro: true }]
  song.intro = { seconds: intro.seconds }
  const dj = globalThis.djs?.rezzy
  if (!dj) return recordings
  const declaration = await fetch(new URL(`sessions/dj-${dj.name}-${airing.song}.json`, airing.archive))
    .then((r) => (r.ok ? r.json() : undefined))
    .catch(() => undefined)
  const said = declaration?.parts?.intro
  if (!said?.speech?.text) return recordings
  // a DJ has something to say: they may begin to walk on, while it is being said
  song.intro.coming = true
  // a promo has less time: fewer sentences, said faster (see `briefIntro`)
  const words = shortened ? briefly(said.speech.text) : said.speech.text
  const squeeze = shortened ? (said.speech.squeeze ?? 1) * briefIntro.speed : said.speech.squeeze
  // a page that cannot speak still plays the intro's music
  const spoken = await say(dj.request(words, squeeze)).catch((error) => {
    console.warn(`the page cannot speak: ${error}`)
    return undefined
  })
  if (!spoken) return recordings
  // a promo's intro lasts as long as its speech and a short tail; what comes before is not heard,
  // as if the page had joined the intro late, and the speech follows the Song's moment 0 back
  if (shortened) song.intro.seconds = Math.min(intro.seconds, briefIntro.lead + spoken.end + briefIntro.tail)
  const at = shortened ? -song.intro.seconds + briefIntro.lead : -intro.seconds + said.at
  const id = `dj-${dj.name}-${airing.song}`
  // the speech is already samples: it is heard like a take the page sang, and never fetched
  song.voices.set(id, spoken.samples)
  recordings.push({ id, said: true, at, kind: 'voice', voice: 'dj', seconds: spoken.end, gain: 0.9 })
  song.intro.speech = { title: dj.title, at, seconds: spoken.end, words, moves: dj.movements(spoken.segments) }
  return recordings
}

/** How many Recordings are fetched at once. */
const fetching = 6
/** How much of a Song, in seconds from where it is joined, must be here before it begins. */
const startingStretch = 20

function prepare(airing) {
  if (songs.has(placeOf(airing))) return songs.get(placeOf(airing))
  const place = placeOf(airing)
  const song = { place, airing, session: undefined, files: new Map(), voices: new Map(), uses: new Map(), gone: new Set(), ready: false, startable: false, fetched: 0, needed: 0, missing: 0 }
  songs.set(place, song)
  let started
  song.starting = new Promise((resolve) => (started = resolve))
  song.preparing = (async () => {
    song.session = await fetch(airing.session).then((r) => r.json())
    // a visit to the Song's page hears its intro first, before its moment 0. It is made ready
    // alongside the Song, not before it: the intro's speech takes the throats' time, and the
    // takes are sung meanwhile. The Song may begin once both are ready.
    const introducing = (airing.visit ? introOf(song, airing) : Promise.resolve([])).catch(() => [])
    let introduced
    // joined late, a listener needs nothing that is already over
    const from = Number.isFinite(airing.begins) ? Math.max(0, (now() - airing.begins) / 1000) : 0
    const heard = song.session.recordings
      .filter(({ at, seconds, fade }) => seconds === undefined || at + seconds + (fade ?? 0) > from)
    heard.sort((a, b) => a.at - b.at)
    song.heard = new Set(heard)
    // the Music is fetched; voices with takes, spoken lines, and procedural synth tracks are made locally
    const isLocal = (r) => Boolean(r.take || r.said || r.speech || r.synth)
    const ids = [...new Set(heard.filter((r) => !isLocal(r)).map(({ id }) => id))]
    const takes = new Map()
    const speeches = new Map()
    const synths = new Map()
    for (const recording of heard) {
      if (recording.take) {
        if (!takes.has(recording.id)) takes.set(recording.id, recording)
        song.uses.set(recording.id, (song.uses.get(recording.id) ?? 0) + 1)
      } else if (recording.speech) {
        if (!speeches.has(recording.id)) speeches.set(recording.id, recording)
        song.uses.set(recording.id, (song.uses.get(recording.id) ?? 0) + 1)
      } else if (recording.synth) {
        if (!synths.has(recording.id)) synths.set(recording.id, recording)
        song.uses.set(recording.id, (song.uses.get(recording.id) ?? 0) + 1)
      }
    }
    const first = new Set(heard.filter(({ at }) => at < from + startingStretch).map(({ id }) => id))
    song.needed = ids.length + takes.size + speeches.size + synths.size
    song.first = first.size
    const here = (id) => song.files.has(id) || song.voices.has(id) || song.gone.has(id)
    song.done = () => {
      if (song.startable || !introduced) return
      if (![...first].every(here)) return
      song.startable = true
      started()
    }
    for (const recording of takes.values()) wantSung(song, recording)
    for (const recording of speeches.values()) {
      say(recording.speech)
        .then(({ samples }) => {
          song.voices.set(recording.id, samples)
          song.fetched++
          song.done()
        })
        .catch(() => {
          song.gone.add(recording.id)
          song.missing = song.gone.size
          song.done()
        })
    }
    if (synths.size) {
      ;(async () => {
        for (const recording of synths.values()) {
          await new Promise((resolve) => setTimeout(resolve, 0))
          try {
            const samples = globalThis.ikuradioSynth?.render(recording.synth)
            if (samples) {
              song.voices.set(recording.id, samples)
              song.fetched++
            } else {
              song.gone.add(recording.id)
              song.missing = song.gone.size
            }
          } catch {
            song.gone.add(recording.id)
            song.missing = song.gone.size
          }
          song.done()
        }
      })()
    }
    // throats opened already, while the Session was fetched, are idle and are given the first takes now
    singSoon()
    const fetchOne = async (id) => {
      for (let attempt = 0; ; attempt++) {
        try {
          const url = new URL(`recordings/${id}`, airing.archive)
          const response = await fetch(url)
          // a Song whose voices were lost before the Archive kept everything;
          // its words remain, and the rest of it is not asked for
          if ((response.status === 403 || response.status === 404) && attempt >= 1) return false
          if (!response.ok) throw new Error(`${response.status}`)
          song.files.set(id, await response.arrayBuffer())
          song.fetched++
          return true
        } catch {
          // the Archive is busy, or the way to it; ask again, a little later
          await new Promise((resolve) => setTimeout(resolve, Math.min(10_000, 500 * 2 ** attempt)))
        }
      }
    }
    const queue = [...ids]
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()
        if (!(await fetchOne(id))) {
          for (const lost of [id, ...queue.splice(0)]) song.gone.add(lost)
          song.missing = song.gone.size
        }
        song.done()
      }
    }
    // the intro joins the Song when it is ready: its recordings are heard like any other
    const joining = introducing.then(async (recordings) => {
      heard.push(...recordings)
      for (const recording of recordings) song.heard.add(recording)
      song.session.recordings.push(...recordings)
      for (const recording of recordings) if (recording.at < from + startingStretch) first.add(recording.id)
      song.first = first.size
      introduced = recordings
      song.done()
      for (const recording of recordings) {
        if (isLocal(recording)) continue
        song.needed++
        if (!(await fetchOne(recording.id))) song.gone.add(recording.id)
        song.done()
      }
    })
    await Promise.all([...Array.from({ length: fetching }, worker), joining])
    song.ready = true
  })().catch(() => {
    // a Session that cannot be read is forgotten, and asked for again
    songs.delete(place)
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
  const scaledTrack = kind === 'drone' || kind === 'pulse' || kind === 'drums'
  if (scaledTrack && gain !== undefined && gain <= 0) return 0
  const wanted =
    kind === 'voice' || kind === 'spoken'
      ? voiceLoudness + 20 * Math.log10(gain ?? 1)
      : scaledTrack
        ? voiceLoudness - bedsUnder + 20 * Math.log10(gain ?? 1)
        : voiceLoudness - bedsUnder
  const raise = Math.min(mostRaised, wanted - loudness.lufs, ceiling - loudness.peak)
  return 10 ** (raise / 20)
}

// Everything goes out through a gentle limiter, so that the moments when
// the whole choir and the Music swell together are held, not clipped.
let out
let master
function speakers(audioContext) {
  if (!out) {
    out = audioContext.createDynamicsCompressor()
    out.threshold.value = -6
    out.knee.value = 6
    out.ratio.value = 12
    out.attack.value = 0.003
    out.release.value = 0.25
    // the one level the whole page sounds at, so a promo can fade all of it out
    master = audioContext.createGain()
    out.connect(master)
    master.connect(audioContext.destination)
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

// A DJ's voice. It is not the choir's: no echo, which makes the words hard to
// hear, and the processing of a voice on the radio. The low end is cleared away
// and the warmth of a close microphone is given back, the presence where
// consonants are is lifted, the dynamics are held close, and a little grit
// from a worked valve is added. Everything is kept gentle, for the voice is
// young and quiet, and has not to sound like it is shouting.
let djBus
function dj(audioContext) {
  if (!djBus) {
    const filter = (type, frequency, { gain = 0, q = 0.7 } = {}) => {
      const node = audioContext.createBiquadFilter()
      node.type = type
      node.frequency.value = frequency
      node.gain.value = gain
      node.Q.value = q
      return node
    }
    const chain = [
      filter('highpass', 95),
      filter('lowshelf', 190, { gain: 3 }),
      filter('peaking', 3200, { gain: 4.5, q: 0.9 }),
      filter('lowpass', 13000),
    ]
    const squeeze = audioContext.createDynamicsCompressor()
    squeeze.threshold.value = -26
    squeeze.knee.value = 10
    squeeze.ratio.value = 5
    squeeze.attack.value = 0.004
    squeeze.release.value = 0.14
    // soft saturation: a tanh curve, only a little bent
    const grit = audioContext.createWaveShaper()
    const drive = 1.6
    grit.curve = Float32Array.from({ length: 1024 }, (_, i) => Math.tanh(((i / 511.5) - 1) * drive) / Math.tanh(drive))
    grit.oversample = '2x'
    const makeup = audioContext.createGain()
    makeup.gain.value = 0.7
    djBus = chain[0]
    ;[...chain, squeeze, grit, makeup].reduce((from, to) => (from.connect(to), to))
    makeup.connect(speakers(audioContext))
  }
  return djBus
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
// While a DJ speaks, the music under them is this much lower, and rises again
// over the last seconds of the speech.
const ducked = 0.38
const risesOver = 3

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

// Declarative browser-side spatial sends (hall reverb + tempo-synced stereo dub echo).
// Both ring out naturally across silence drops when a dry source stops, and are
// faded & reset cleanly on mode switches (`stopAllSounds`).
let reverbSpace
const echoSpaces = new Map()

function reverbImpulse(audioContext, duration = 3.8) {
  const sr = audioContext.sampleRate
  const length = Math.round(sr * duration)
  const buffer = audioContext.createBuffer(2, length, sr)
  // deterministic PRNG so every Receiver builds the same warm stereo hall
  let seed = 0x5f3759df
  const nextRand = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5
  }
  const early = [
    [0.019, 0.42, 0.18],
    [0.031, 0.22, 0.38],
    [0.047, 0.34, 0.2],
    [0.064, 0.16, 0.3],
    [0.083, 0.25, 0.24],
  ]
  const alpha = 0.22 // warm high-frequency damping across the hall tail
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < length; i++) {
      const t = i / sr
      const env = Math.pow(1 - t / duration, 2.4) * Math.exp(-t / 1.35)
      const white = nextRand() * 2
      lp += alpha * (white - lp)
      data[i] = lp * env * 0.48
    }
    for (const [at, gL, gR] of early) {
      const idx = Math.round(at * sr)
      if (idx < length) data[idx] += (ch === 0 ? gL : gR) * 0.32
    }
  }
  return buffer
}

function reverbBus(audioContext) {
  if (!reverbSpace) {
    const input = audioContext.createGain()
    const convolver = audioContext.createConvolver()
    convolver.buffer = reverbImpulse(audioContext)
    const wet = audioContext.createGain()
    wet.gain.value = 0.68
    input.connect(convolver)
    convolver.connect(wet)
    wet.connect(speakers(audioContext))
    reverbSpace = { input, wet, convolver }
  }
  return reverbSpace.input
}

function echoBus(audioContext, delaySeconds) {
  const safe = Number.isFinite(delaySeconds) && delaySeconds > 0 ? delaySeconds : 0.6
  const clamped = Math.max(0.15, Math.min(1.8, safe))
  const key = Math.round(clamped * 20) * 50 // bucket to 50ms steps to reuse buses cleanly
  const existing = echoSpaces.get(key)
  if (existing) return existing.input
  const d = key / 1000
  const input = audioContext.createGain()
  const wet = audioContext.createGain()
  wet.gain.value = 0.72
  wet.connect(speakers(audioContext))
  const delayL = audioContext.createDelay(2)
  const delayR = audioContext.createDelay(2)
  delayL.delayTime.value = d
  delayR.delayTime.value = Math.min(1.95, d * 1.03)
  const toneL = audioContext.createBiquadFilter()
  const toneR = audioContext.createBiquadFilter()
  toneL.type = 'lowpass'
  toneR.type = 'lowpass'
  toneL.frequency.value = 2100
  toneR.frequency.value = 1650
  const fbL = audioContext.createGain()
  const fbR = audioContext.createGain()
  fbL.gain.value = 0.44
  fbR.gain.value = 0.42
  const panL = audioContext.createStereoPanner()
  const panR = audioContext.createStereoPanner()
  panL.pan.value = -0.45
  panR.pan.value = 0.45
  // ping-pong stereo dub loop: input -> L -> R -> L ..., darkening with each bounce
  input.connect(delayL)
  delayL.connect(toneL)
  toneL.connect(panL).connect(wet)
  toneL.connect(fbL).connect(delayR)
  delayR.connect(toneR)
  toneR.connect(panR).connect(wet)
  toneR.connect(fbR).connect(delayL)
  const space = { input, wet, delayL, delayR, toneL, toneR, fbL, fbR, panL, panR }
  echoSpaces.set(key, space)
  return input
}

/** Resolves the active musical tempo (BPM) at a moment in the Session, honoring per-part tempo changes. */
function tempoAt(session, at) {
  const allParts = session?.iterations?.flatMap((it) => it.parts ?? []) ?? []
  let lastTimed
  for (const part of allParts) {
    const partTempo = part.tempo === undefined ? session.tempo : part.tempo
    if (typeof partTempo === 'number' && partTempo > 0) lastTimed = partTempo
    if (at >= part.at - 0.05 && at < part.at + (part.seconds ?? 0) - 0.05) {
      return typeof partTempo === 'number' && partTempo > 0 ? partTempo : (lastTimed || session.tempo || 76)
    }
  }
  return lastTimed || session?.tempo || 76
}

/** Currently scheduled or playing Web Audio sources so switching modes silences the old Song immediately. */
const activeSources = new Set()

function stopAllSounds(audioContext) {
  const t = audioContext?.currentTime ?? 0
  for (const entry of activeSources) {
    activeSources.delete(entry)
    try {
      entry.level.gain.cancelScheduledValues(t)
      entry.level.gain.setValueAtTime(entry.level.gain.value, t)
      entry.level.gain.linearRampToValueAtTime(0, t + 0.06)
      entry.source.stop(t + 0.07)
    } catch {}
  }
  // also silence and reset spatial send tails on explicit mode switch so old reverb/echo never bleeds into live
  if (reverbSpace) {
    const old = reverbSpace
    reverbSpace = undefined
    try {
      old.wet.gain.cancelScheduledValues(t)
      old.wet.gain.setValueAtTime(old.wet.gain.value, t)
      old.wet.gain.linearRampToValueAtTime(0, t + 0.06)
      setTimeout(() => {
        try {
          old.wet.disconnect()
          old.convolver.disconnect()
          old.input.disconnect()
        } catch {}
      }, 100)
    } catch {}
  }
  for (const [key, old] of echoSpaces) {
    echoSpaces.delete(key)
    try {
      old.fbL.gain.setValueAtTime(0, t)
      old.fbR.gain.setValueAtTime(0, t)
      old.wet.gain.cancelScheduledValues(t)
      old.wet.gain.setValueAtTime(old.wet.gain.value, t)
      old.wet.gain.linearRampToValueAtTime(0, t + 0.06)
      setTimeout(() => {
        for (const node of [old.input, old.delayL, old.delayR, old.toneL, old.toneR, old.fbL, old.fbR, old.panL, old.panR, old.wet]) {
          try {
            node.disconnect()
          } catch {}
        }
      }, 100)
    } catch {}
  }
}

/**
 * Places every sound that begins soon, or began a moment ago and is still
 * going, on the audio clock: at the moment the Tactus says, translated into
 * the audio clock's time just before it is placed, so the two never drift
 * apart for long. A sound already under way is joined where it would be.
 */
function placeSounds(audioContext) {
  const gen = generation
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
      const local = Boolean(recording.take || recording.said || recording.speech || recording.synth)
      if (recording.seconds !== undefined && until + recording.seconds + (recording.fade ?? 0) <= 0) {
        song.placed.add(n)
        if (local) heardOnce(song, recording)
        return
      }
      let buffering
      if (local) {
        // a take, speech, or synth made locally: its samples become a sound, and are let go once heard for the last time
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
        if (gen !== generation) return
        const since = (now() - starts) / 1000
        if (since >= buffer.duration) return
        const when = audioContext.currentTime - since
        const source = audioContext.createBufferSource()
        source.buffer = buffer
        const level = audioContext.createGain()
        const owned = [source, level]
        const mix = recording.mix
        let chain = level
        if (mix?.filter !== undefined && mix.filter < 0.99) {
          const lp = audioContext.createBiquadFilter()
          lp.type = 'lowpass'
          const norm = Math.max(0, Math.min(1, mix.filter))
          lp.frequency.value = 260 * Math.pow(18000 / 260, norm)
          lp.Q.value = 0.85
          chain.connect(lp)
          chain = lp
          owned.push(lp)
        }
        let stopAt
        if (recording.kind === 'bed' || recording.kind === 'drone' || recording.kind === 'pulse' || recording.kind === 'drums') {
          const gain = levelOf(recording)
          const now = audioContext.currentTime
          // a bed with a tail is held through its place, then fades out under
          // what follows, which has already begun; one without lets go softly at its end
          const fade = recording.fade && recording.seconds !== undefined ? recording.fade : letGoOf
          const fades = recording.fade && recording.seconds !== undefined
            ? when + recording.seconds
            : when + buffer.duration - letGoOf
          const ends = Math.min(when + buffer.duration, fades + fade)
          if (ends <= now) return
          const fadeIn = recording.fadeIn > 0 ? recording.fadeIn : 0
          const risenAt = Math.min(when + fadeIn, fades)
          const hasFadeIn = fadeIn > 0 && fades > now && risenAt > now
          if (hasFadeIn) {
            const startGain = when >= now ? 0 : gain * Math.min(1, Math.max(0, (now - when) / fadeIn))
            level.gain.setValueAtTime(startGain, Math.max(now, when))
            level.gain.linearRampToValueAtTime(gain, risenAt)
          } else {
            level.gain.value = gain
          }
          // under a DJ's speech the intro's music lies lower, and comes back
          // up over the last seconds of what is said
          const speech = recording.intro ? song.intro?.speech : undefined
          if (speech) {
            const begins = when + (speech.at - recording.at)
            // never past the end of the intro's own place, where its tail begins to fade
            const speechEnds = Math.min(begins + speech.seconds, when + recording.seconds, fades)
            const floor = hasFadeIn ? risenAt : 0
            if (speechEnds > Math.max(now, floor)) {
              const low = gain * (1 - ducked)
              const rises = Math.max(begins, speechEnds - risesOver)
              level.gain.setValueAtTime(gain, Math.min(fades, Math.max(floor, begins - 0.3)))
              level.gain.linearRampToValueAtTime(low, Math.min(fades, Math.max(floor, begins)))
              level.gain.setValueAtTime(low, Math.min(fades, Math.max(floor, rises)))
              level.gain.linearRampToValueAtTime(gain, speechEnds)
            }
          }
          if (fades <= now) {
            level.gain.setValueAtTime(Math.max(0, gain * (1 - (now - fades) / fade)), now)
          } else if (!hasFadeIn || fades > risenAt) {
            level.gain.setValueAtTime(gain, fades)
          }
          level.gain.linearRampToValueAtTime(0, Math.max(now, ends))
          stopAt = Math.max(now, ends) + 0.05
          source.connect(level)
          if (mix?.pan) {
            const panner = audioContext.createStereoPanner()
            panner.pan.value = Math.max(-1, Math.min(1, mix.pan))
            chain.connect(panner).connect(music(audioContext))
            owned.push(panner)
          } else {
            chain.connect(music(audioContext))
          }
        } else {
          const gain = levelOf(recording)
          const now = audioContext.currentTime
          const fadeIn = recording.fadeIn > 0 ? recording.fadeIn : 0
          const risenAt = when + fadeIn
          if (fadeIn > 0 && risenAt > now) {
            const startGain = when >= now ? 0 : gain * Math.min(1, Math.max(0, (now - when) / fadeIn))
            level.gain.setValueAtTime(startGain, Math.max(now, when))
            level.gain.linearRampToValueAtTime(gain, risenAt)
          } else {
            level.gain.value = gain
          }
          source.connect(level)
          if (recording.said) {
            // a DJ speaks to the listener, in the middle, close, and without an echo
            chain.connect(dj(audioContext))
          } else if (recording.kind === 'spoken' || recording.speech) {
            // a spoken part sits intimate and dry, without heavy choir echo (unless mix sends it to space)
            if (mix?.pan) {
              const panner = audioContext.createStereoPanner()
              panner.pan.value = Math.max(-1, Math.min(1, mix.pan))
              chain.connect(panner).connect(speakers(audioContext))
              owned.push(panner)
            } else {
              chain.connect(speakers(audioContext))
            }
          } else {
            const place = audioContext.createStereoPanner()
            place.pan.value = Math.max(-1, Math.min(1, standingOf(recording.voice) + (mix?.pan ?? 0)))
            chain.connect(place).connect(voices(audioContext))
            owned.push(place)
          }
        }
        // declarative browser-side spatial sends (ring out naturally across silence drops after dry source stops)
        if (mix?.reverb > 0) {
          const send = audioContext.createGain()
          send.gain.value = Math.min(1, mix.reverb) * 0.85
          chain.connect(send).connect(reverbBus(audioContext))
          owned.push(send)
        }
        if (mix?.echo > 0) {
          const bpm = recording.synth?.bpm || recording.take?.bpm || tempoAt(song.session, recording.at)
          const beats = mix.echoBeats || 0.75
          const send = audioContext.createGain()
          send.gain.value = Math.min(1, mix.echo) * 0.72
          chain.connect(send).connect(echoBus(audioContext, (beats * 60) / bpm))
          owned.push(send)
        }
        const entry = { source, level }
        activeSources.add(entry)
        source.onended = () => {
          activeSources.delete(entry)
          for (const node of owned) {
            try {
              node.disconnect()
            } catch {}
          }
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
    // (a DJ's words, still scrolling away, are kept)
    for (const child of [...output.children]) if (!child.classList.contains('dj')) child.remove()
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
      describe(session, iteration, song.airing.mode === 'encore')
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
      const role = part.words ?? (part.type === 'bridge' ? 'none' : 'written')
      switchStoryElement(output, role === 'none' ? `${part.type} wordless` : part.type, part.lines)
      if (showing && showing.part !== part) {
        showing.part = part
        tellDetails()
      }
      if (role === 'none' && t < part.at + part.seconds) bridgeBegins(el)
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

function describe(session, iteration, encore = false) {
  if (showing?.session !== session) window.space?.tune(session.song)
  showing = { session, iteration }
  const inPlaylist = playlist && playlist.items?.length && playlist.at !== undefined
  document.getElementById('status').replaceChildren(
    // a rerun is not mistaken for a new Song: the Tactus declares it an encore
    ...(encore ? [span('encore', 'encore · ')] : []),
    span('song', `Song ${number(session.song)}`),
    ...(inPlaylist ? [span('side', ` · ${playlist.at + 1} of ${playlist.items.length}`)] : []),
    span('side', ` · iteration ${number(iteration.iteration)}`),
    // the name, written after the iteration, as the Song is known
    ...(session.name ? [span('side', ` · ${session.name}`)] : []),
  )
  tellDetails()
}

/** What the status line says while nothing is being sung. */
function waiting(words) {
  document.getElementById('status').replaceChildren(document.createTextNode(words))
}

// Rezzy, drawn (plan "Intro with Rezzy"): a small creature of a radio, the
// receiver's own kind, in the page's own dots, only while a Song's intro
// plays and there is a speech to move with. Like the receiver, Rezzy has a lopsided
// hull with a bright rim, an antenna that pulls out in pieces with a warm tip,
// a feeler, a dial for an eye, a speaker of slats for a mouth, and uneven
// feet. Rezzy is an announcer, not an animal: they walk on from beyond the
// edge of the screen while the Song is still readying, a steady gait, feet
// taking turns, and stand where they are while the intro plays, which begins
// when they are in position. The speaker opens on each vowel, the dial's
// needle swings with it, the antenna's tip glows with the voice, and the body
// leans a little where the voice does. Between syllables Rezzy breathes, and
// now and then blinks. Rezzy stays two seconds into the Song, and walks off.
const rezzy = (() => {
  const canvas = document.getElementById('rezzy')
  const context = canvas.getContext('2d')
  // Rezzy's grid is 20 dots across and 19 down; how far apart the dots lie is set by the size she is given
  const columns = 20
  const rowsOf = 19
  let pitch = 6
  // the receiver's colours: hull, the rim catching the light, and the warm of its antenna
  const hull = '#38536c'
  const hullLit = '#6284a4'
  const rim = '#a9c4b3'
  const amber = '#ffb347'
  /** How long a walk on or off takes, in milliseconds. */
  const walkMs = 2400
  /** How many steps a second the gait keeps. */
  const stepsPerSecond = 2.4
  let on
  let frame
  /**
   * Rezzy is drawn in the bottom right corner, as large as the screen allows:
   * her area no more than 14.6% of the square of the screen's shorter side, so that a
   * wide, short screen does not make her tall, and no larger than the receiver's
   * likeness as it comes in (the width the CSS gives it: 78vw, 432px, 55vh).
   * Her dots are drawn at the device's own pixels, so they stay round.
   */
  function fit() {
    const width = innerWidth
    const height = innerHeight
    const likeness = Math.min(0.78 * width, 432, 0.55 * height)
    const shorter = Math.min(width, height)
    const across = Math.min(likeness, Math.sqrt(0.146 * shorter * shorter * (columns / rowsOf)))
    const scale = devicePixelRatio || 1
    pitch = Math.max(2, Math.floor((across * scale) / columns))
    canvas.width = pitch * columns
    canvas.height = pitch * rowsOf
    canvas.style.width = `${canvas.width / scale}px`
    canvas.style.height = `${canvas.height / scale}px`
    // a DJ's words keep to the room Rezzy leaves them, and do not run under them
    document.documentElement.style.setProperty('--rezzy-room', `${canvas.width / scale + 40}px`)
  }
  addEventListener('resize', () => {
    if (on) fit()
  })
  const dot = (x, y, colour, alpha = 1, size = 0.34) => {
    context.globalAlpha = alpha
    context.fillStyle = colour
    context.beginPath()
    context.arc(x * pitch + pitch / 2, y * pitch + pitch / 2, pitch * size, 0, Math.PI * 2)
    context.fill()
  }
  /** Dots along a line of points, a dot to a step. */
  const along = (points, colour, alpha = 1, size = 0.3) => {
    for (let i = 0; i + 1 < points.length; i++) {
      const [x0, y0] = points[i]
      const [x1, y1] = points[i + 1]
      const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)))
      for (let k = 0; k < steps; k++) dot(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps, colour, alpha, size)
    }
  }
  /** What the movements ask at `t` seconds into the speech: how open the mouth is, and how far the body is up. */
  function moving(moves, t) {
    for (const move of moves) {
      if (t < move.at) break
      if (t < move.at + move.seconds) {
        const swell = Math.sin(((t - move.at) / move.seconds) * Math.PI)
        return { mouth: move.mouth * Math.pow(swell, 0.7), bob: move.bob * swell }
      }
    }
    return { mouth: 0, bob: 0 }
  }
  let glow = 0 // the tip's glow follows the voice, a little slower than it
  function draw() {
    frame = undefined
    if (!on) return
    const t = (now() - on.start) / 1000
    const { mouth, bob } = moving(on.moves, t)
    const still = stillness.matches
    // the walk, on or off: the whole of Rezzy slides in or out over the edge of the screen,
    // the feet taking turns, the body rising a little on each step
    let heading = 0
    let phase = 0
    if (on.walk !== 'here') {
      const progress = Math.min(1, (now() - on.since) / walkMs)
      const eased = progress * progress * (3 - 2 * progress)
      const far = parseFloat(canvas.style.width) + 96
      canvas.style.transform = `translateX(${(on.walk === 'in' ? 1 - eased : eased) * far}px)`
      heading = on.walk === 'in' ? -1 : 1
      phase = (now() / 1000) * stepsPerSecond * Math.PI
      if (progress >= 1) {
        if (on.walk === 'in') {
          on.walk = 'here'
          canvas.style.transform = ''
          heading = 0
        } else {
          finish()
          return
        }
      }
    }
    glow += (mouth - glow) * 0.25
    const breath = still ? 0 : Math.sin((now() / 1000) * 2.1) * 0.3
    const stride = heading ? Math.abs(Math.sin(phase)) * 0.4 : 0
    const hop = still ? 0 : bob * 0.7 + breath + stride
    const blink = !still && Math.floor(now() / 1000) % 5 === 0 && now() % 1000 < 140
    // a row of room above, for the antenna when the body hops
    context.setTransform(1, 0, 0, 1, 0, pitch)
    context.clearRect(0, -pitch, canvas.width, canvas.height)

    // the uneven feet and the legs: still where they stand, and lifting in turn, forward, when they walk
    const lifts = [heading ? Math.max(0, Math.sin(phase)) : 0, heading ? Math.max(0, -Math.sin(phase)) : 0]
    for (const [x, y] of [[5, 16], [6, 17], [5, 17]]) dot(x + heading * lifts[0], y - lifts[0] * 1.2, rim, 0.9, 0.3)
    for (const [x, y] of [[12, 16], [13, 17], [14, 17], [12, 17]]) dot(x + heading * lifts[1], y - lifts[1] * 1.2, rim, 0.9, 0.3)

    // the body rises with the voice
    context.translate(0, -hop * pitch * 0.5)
    // the hull: a lopsided oval of haze, its rim catching the light
    for (let y = 4; y < 17; y++) {
      for (let x = 0; x < 20; x++) {
        const dx = (x - 9.5 - (y - 10.5) * 0.1) / 7.8
        const dy = (y - 10.5) / 5
        const d = dx * dx + dy * dy
        if (d > 1) continue
        if (d > 0.72) dot(x, y, rim, 0.9)
        else dot(x, y, d < 0.3 && x < 9 ? hullLit : hull, d < 0.3 ? 0.55 : 0.75)
      }
    }
    // the dial for an eye, on the right, ticked, and the needle swinging with the voice
    for (let k = 0; k < 12; k++) {
      const angle = (k / 12) * Math.PI * 2
      dot(12.3 + Math.cos(angle) * 2.3, 9.8 + Math.sin(angle) * 2.3, k % 3 === 0 ? amber : rim, k % 3 === 0 ? 0.95 : 0.7, 0.26)
    }
    const needle = -1.1 + mouth * 1.5 + (still ? 0 : Math.sin(now() / 700) * 0.06)
    along([[12.3, 9.8], [12.3 + Math.cos(needle) * 1.9, 9.8 + Math.sin(needle) * 1.9]], amber, 1, 0.3)
    dot(12.3, 9.8, amber, 1, 0.38)
    // the other eye, small, on the left, which blinks
    for (const [x, y] of blink ? [[6.2, 10]] : [[6.2, 9.4], [6.2, 10.3]]) dot(x, y, '#ffffff', 0.95, 0.36)
    // the speaker of slats: a grille either side, and the mouth between them, opening
    for (const y of [12.6, 15]) for (let x = 6.5; x <= 12.5; x++) dot(x, y, rim, 0.3, 0.22)
    const open = Math.round(mouth * 4) / 2
    for (let x = 7.5; x <= 11.5; x++) dot(x, 13.8, amber, 1, 0.3)
    for (let k = 1; k <= open; k++) for (let x = k === Math.max(1, Math.floor(open)) && open >= 2 ? 8.5 : 7.5; x <= (k === Math.max(1, Math.floor(open)) && open >= 2 ? 10.5 : 11.5); x++) dot(x, 13.8 + k * 0.8, amber, 0.9, 0.3)

    // the feeler, which flicks with the voice, and the antenna, pulled out in pieces, bent
    const flick = still ? 0 : bob * 1.2
    along([[4, 7], [2.6, 5.8 - flick], [1, 6.8 - flick]], rim, 0.9, 0.28)
    const sway = still ? 0 : Math.sin(now() / 480) * 0.35 + bob * 0.4 + (heading ? Math.sin(phase / 2) * 0.5 : 0)
    const kink = [[6, 6.4], [7, 3.4], [8.8 + sway * 0.4, 4.2], [10.6 + sway, 1.2]]
    along(kink, rim, 0.95, 0.3)
    // its tip, the brightest thing in it, warm enough to bleed into the dark around it
    const [tx, ty] = kink[3]
    dot(tx, ty, amber, 0.18 + glow * 0.3, 0.95 + glow * 0.6)
    dot(tx, ty, amber, 1, 0.5)
    context.globalAlpha = 1
    frame = requestAnimationFrame(draw)
  }
  /** Rezzy is gone: off the screen, not drawn. */
  function finish() {
    on = undefined
    canvas.hidden = true
    canvas.style.transform = ''
    if (frame) cancelAnimationFrame(frame)
    frame = undefined
  }
  return {
    /**
     * Rezzy walks on from beyond the right edge of the screen, once; asked
     * again, they are already on their way, or here. Returns when they will
     * be in position, in the page's time.
     */
    comeIn(standing = false) {
      if (on) return on.arrives
      fit()
      const since = now()
      // a promo has Rezzy there already, where the recording begins
      const walks = !standing && !stillness.matches
      on = { moves: [], start: Infinity, walk: walks ? 'in' : 'here', since, arrives: since + (walks ? walkMs : 0) }
      // out of sight to begin with, so that they are never seen at their place before they walk on
      canvas.style.transform = on.walk === 'in' ? `translateX(${parseFloat(canvas.style.width) + 96}px)` : ''
      canvas.hidden = false
      frame = requestAnimationFrame(draw)
      return on.arrives
    },
    /** Rezzy moves their mouth, their needle and their body with `moves`, which begin at `start`, in the page's time. */
    speak(moves, start) {
      if (on) {
        on.moves = moves
        on.start = start
      }
    },
    /** Rezzy walks off, to the right, and is gone. */
    leave() {
      if (!on || on.walk === 'out') return
      if (stillness.matches) return finish()
      on.walk = 'out'
      on.since = now()
    },
    /** Rezzy is put away. */
    away() {
      if (on) finish()
    },
  }
})()

/** How long Rezzy stays in the Song, after it has begun, before they walk off, in seconds. */
const staysFor = 2

/** How long a DJ's words take to scroll up and away, once the Song has begun, in seconds. */
const scrollsAway = 6

/** How heavily each character weighs in the time a DJ takes to say it: a letter, a space, a pause at a comma, a longer one at a stop. */
const weighs = (character) => (/[,;:]/.test(character) ? 3 : /[.!?]/.test(character) ? 5 : /\s/.test(character) ? 0.6 : 1)

/**
 * A DJ's words, typed as the Song's are, into the same page, as the DJ says
 * them: a paragraph of its own, in its own light, whose room is kept from the
 * first, so the page does not jump as the words arrive.
 */
/**
 * Keeps a DJ's words from jumping when the Song's own text comes in under them. The page keeps
 * its words at the bottom, so every new line pushes the ones above it up at once; here the push is
 * seen: whatever the words' place in the page changes by, they are put back where they were seen,
 * and let up to their place quickly. They are moved with `translate`, which the words' leaving, a
 * `transform`, does not touch.
 */
function glide(node) {
  if (stillness.matches) return
  let top = node.offsetTop
  let offset = 0
  let before = performance.now()
  const step = (at) => {
    if (!node.isConnected) return
    if (node.offsetTop !== top) {
      offset += top - node.offsetTop
      top = node.offsetTop
    }
    offset *= Math.exp(-(at - before) / 1000 / glideSeconds)
    before = at
    if (Math.abs(offset) < 0.3) offset = 0
    node.style.translate = offset ? `0 ${offset}px` : ''
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
/** How quickly words pushed up by the Song's text slide to their place: most of the way in this many seconds, a little over. */
const glideSeconds = 0.16

function typeSpeech(speech, t) {
  const output = listening?.output
  if (!output) return
  if (!speech.node) {
    if (t < speech.at) return
    const node = document.createElement('p')
    node.className = 'dj'
    node.append(document.createTextNode(''), Object.assign(document.createElement('span'), { className: 'unsaid', textContent: speech.words }))
    output.appendChild(node)
    glide(node)
    let total = 0
    speech.weights = [...speech.words].map((character) => (total += weighs(character)))
    speech.total = total
    speech.node = node
  }
  const along = Math.max(0, Math.min(1, (t - speech.at) / speech.seconds))
  const shown = speech.weights.filter((cumulative) => cumulative <= along * speech.total).length
  const [said, unsaid] = [speech.node.firstChild, speech.node.lastChild]
  if (said.data.length !== shown) {
    said.data = speech.words.slice(0, shown)
    unsaid.textContent = speech.words.slice(shown)
  }
}

/** The DJ's words, once the Song has begun, scroll up and out of the Song's way, and are let go. */
function scrollAway(speech) {
  const node = speech.node
  if (!node || speech.going) return
  speech.going = true
  // what has not been said by now is not said: the words are whole
  node.firstChild.data = speech.words
  node.lastChild.textContent = ''
  const still = stillness.matches
  node.style.transition = still ? 'opacity 1s' : `transform ${scrollsAway}s cubic-bezier(0.55, 0, 0.9, 0.55), opacity ${scrollsAway}s ease-in`
  requestAnimationFrame(() => {
    if (!still) node.style.transform = `translateY(${-(listening?.output.clientHeight ?? innerHeight)}px)`
    node.style.opacity = '0'
  })
  setTimeout(() => node.remove(), (still ? 1 : scrollsAway) * 1000 + 200)
}

/**
 * While a Song's intro plays, and a DJ has a speech, the DJ is here: walking on
 * while the Song readies, speaking over the intro, their words typed in the
 * Song's own way, still there when the Song begins, and, `staysFor` seconds in,
 * walking off, their words scrolling up and away from the moment the Song
 * begins. `t` is seconds from the Song's moment 0.
 */
function tellIntro(song, t) {
  const speech = song.intro?.speech
  if (!speech) return undefined
  if (t >= 0) scrollAway(speech)
  else typeSpeech(speech, t)
  if (t >= staysFor) {
    rezzy.leave()
    return undefined
  }
  rezzy.comeIn()
  rezzy.speak(speech.moves, song.airing.begins + speech.at * 1000)
  return undefined
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

function arrangementName(slug, title) {
  if (title?.trim()) return title.trim()
  if (!slug || slug === 'the-song') return 'The Song as it always was'
  return slug
    .split('-')
    .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : word))
    .join(' ')
}

function tellParts(session, activePart) {
  const box = document.getElementById('parts')
  if (!box) return
  if (!session) {
    if (box.hasAttribute('data-served')) return
    box.hidden = true
    return
  }
  const iterations = session.iterations ?? []
  const items = iterations.flatMap((it) => it.parts ?? [])
  if (!items.length) {
    box.hidden = true
    return
  }
  const passes = iterations.length
  const summary = box.querySelector('summary')
  const list = box.querySelector('ol')
  summary.textContent =
    passes > 1
      ? `structure · ${passes} iterations, ${items.length} parts`
      : `structure · ${items.length} part${items.length === 1 ? '' : 's'}`
  const variesTempo = items.some((p) => p.tempo !== undefined && p.tempo !== session.tempo)
  list.replaceChildren(
    ...items.map((p) => {
      const li = document.createElement('li')
      if (p === activePart) li.setAttribute('aria-current', 'step')
      const tempo = p.tempo !== undefined ? p.tempo : session.tempo
      const pace = tempo === null ? 'free time' : `${tempo} bpm`
      const lines = p.lines?.length ?? 0
      const meta = [
        `${Math.max(1, Math.round(p.seconds))}s`,
        ...(variesTempo ? [pace] : []),
        ...(p.mode && p.mode !== session.mode ? [p.mode] : []),
        ...(lines > 0 ? [`${lines} line${lines === 1 ? '' : 's'}`] : []),
      ].join(' · ')
      li.append(span('part-type', p.type), span('part-meta', meta))
      return li
    }),
  )
  box.removeAttribute('data-served')
  box.hidden = false
}

function tellDetails() {
  const details = document.getElementById('details')
  if (!showing) {
    // a Song's page comes with what the Radio knows of it: kept until the Song plays
    if (details.hasAttribute('data-served')) return
    details.replaceChildren(row('receiving', playlist ? 'playlist, soon' : replay ? `Song ${replay.number}, soon` : 'nothing yet'))
    tellParts(undefined)
    tellThought(undefined)
    return
  }
  const { session, iteration, part } = showing
  const partTempo = part?.tempo !== undefined ? part.tempo : session.tempo
  const pace = partTempo === null ? 'free time' : `${partTempo} bpm`
  const mode = part?.mode ?? session.mode
  const key = [mode, pace].filter(Boolean).join(', ')
  const passCount = iteration?.of?.of ?? 1
  const iterationLabel = iteration
    ? passCount > 1
      ? `${number(iteration.iteration)}, ${iteration.of.at} of ${passCount}`
      : number(iteration.iteration)
    : undefined
  const songLabel =
    playlist && playlist.items?.length && playlist.at !== undefined
      ? `${number(session.song)}, ${playlist.at + 1} of ${playlist.items.length} in playlist`
      : `${number(session.song)}${replay ? ', from its beginning' : ', live'}`
  details.replaceChildren(
    ...(session.name ? [row('name', session.name)] : []),
    row('song', songLabel),
    row('arrangement', arrangementName(session.arrangement, session.arrangementTitle)),
    ...(session.mood?.length ? [row('weather', session.mood.join(' + '))] : []),
    ...(key ? [row('key', key)] : []),
    ...(session.choir ? [row('choir', session.choir)] : []),
    ...(session.sound ? [row('band', session.sound)] : []),
    ...(session.tracks?.length ? [row('tracks', session.tracks.join(', '))] : []),
    // the ways this Song is heard differently from the usual, if any
    ...(session.perspectives?.length
      ? [row('heard', session.perspectives.map(({ title, variant }) => (variant ? `${title}: ${variant}` : title)).join(', '))]
      : []),
    ...(iterationLabel ? [row('iteration', iterationLabel)] : []),
  )
  tellParts(session, part)
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
// its beginning, at the link its name makes. The Radio hands them out a page at a
// time; the dialog is a window onto them, showing only the rows that fit,
// and is moved, never scrolled: by the wheel, a finger, the keys, or the
// buttons at its corners. The page in view is fetched, and the one after it.
//
// They can be searched, by two filters that know each other: the mode a Song
// was sung in, and how it was heard. Each filter's options are counted given
// the other, and one that would find nothing is shown with its 0 and cannot
// be chosen, so a search never leads nowhere. What is chosen is kept in the
// address, so a search can be passed on. A Radio without its cache offers no
// search, and the filters are not shown.
const rowPx = 52
const received = { total: undefined, rows: [], asked: new Set(), at: 0 }
let firstShown = 0 // the first row in the window

/** What is searched for, from the address: free-text metadata query `q`, a mode, and how a Song was heard (`plainly` or a Perspective's slug). */
const asking = new URLSearchParams(location.search)
const search = { q: (asking.get('q') || '').trim(), mode: asking.get('mode') || '', heard: asking.get('heard') || '' }
/** The filters' options, as the Radio last counted them; undefined while it offers no search. */
let searching
const searchInput = document.getElementById('search-text')
const searchFilters = document.getElementById('search-filters')
if (searchInput) searchInput.value = search.q
if (searchFilters && (search.mode || search.heard)) searchFilters.open = true

/** The search as the Radio is asked it, `&q=…&mode=…&heard=…`, empty without its cache. */
const searchQuery = () =>
  searching ? ['q', 'mode', 'heard'].filter((k) => search[k]).map((k) => `&${k}=${encodeURIComponent(search[k])}`).join('') : ''

/** The height the search takes above the list, when it is shown. */
const searchPx = () =>
  ['song-search', 'song-found'].reduce((sum, id) => {
    const element = document.getElementById(id)
    return sum + (element.hidden ? 0 : element.offsetHeight + 8)
  }, 0)

/** How many rows fit in the window, from the dialog's height and what the search takes of it. */
const pageRows = () => Math.max(3, Math.floor((Math.min(640, innerHeight - 64) - 72 - searchPx()) / rowPx))

/** Asks the Radio for both filters' options, counted given `q` and the other filter, and shows them; hides them if it offers none. */
async function loadOptions() {
  const params = new URLSearchParams()
  for (const key of ['q', 'mode', 'heard']) if (search[key]) params.set(key, search[key])
  const stamp = params.toString()
  try {
    const response = await fetch(`${radio}/songs/options?${stamp}`)
    if (!response.ok) throw new Error(`${response.status}`)
    const data = await response.json()
    // an older options response arriving after the search moved on is ignored
    const current = new URLSearchParams()
    for (const key of ['q', 'mode', 'heard']) if (search[key]) current.set(key, search[key])
    if (current.toString() !== stamp) return
    searching = data
  } catch {
    searching = undefined
  }
  drawSearch()
}

/** What a choice in the address is called when no Song received knows it: its name is the machinery's, and is not shown. */
const unknownWay = 'nothing received'

/** One filter's options: "any", then each with its count, those that would find nothing shown but not chosen. */
function fillFilter(select, options, any, chosen) {
  const choices = [{ value: '', label: any.label, count: any.count }, ...options]
  // a choice in the address that the Songs no longer know is kept, with its 0, so it can be seen and cleared
  if (chosen && !choices.some((o) => o.value === chosen)) choices.push({ value: chosen, label: unknownWay, count: 0 })
  select.replaceChildren(
    ...choices.map(({ value, label, count }) => {
      const option = Object.assign(document.createElement('option'), { value, textContent: `${label} (${count.toLocaleString('en')})` })
      option.disabled = count === 0 && value !== chosen && value !== ''
      option.selected = value === chosen
      return option
    }),
  )
}

/** Shows the search bar, filters, and the line that says what they find, or hides them both. */
function drawSearch() {
  const form = document.getElementById('song-search')
  const found = document.getElementById('song-found')
  form.hidden = !searching
  if (!searching) {
    found.hidden = true
    return drawSongs()
  }
  if (searchInput && document.activeElement !== searchInput && searchInput.value !== search.q) searchInput.value = search.q
  fillFilter(document.getElementById('search-mode'), searching.modes, { label: 'any mode', count: searching.any.mode }, search.mode)
  fillFilter(document.getElementById('search-heard'), searching.heard, { label: 'any way', count: searching.any.heard }, search.heard)
  const named = (options, value) => options.find((o) => o.value === value)?.label ?? unknownWay
  const parts = [
    search.q && { key: 'q', label: `"${search.q}"` },
    search.mode && { key: 'mode', label: named(searching.modes, search.mode) },
    search.heard && { key: 'heard', label: named(searching.heard, search.heard) },
  ].filter(Boolean)
  found.hidden = parts.length === 0
  if (parts.length) {
    const out = (key, label) =>
      Object.assign(document.createElement('button'), { type: 'button', textContent: '×', ariaLabel: `Clear ${label}`, onclick: () => choose({ [key]: '' }) })
    const pieces = []
    for (const [i, { key, label }] of parts.entries()) {
      if (i) pieces.push(document.createTextNode(' · '))
      pieces.push(document.createTextNode(label), out(key, label))
    }
    const count = received.total
    const ranked = search.q ? ', by relevance' : ''
    pieces.push(document.createTextNode(count === undefined ? ': …' : `: ${count.toLocaleString('en')} Song${count === 1 ? '' : 's'}${ranked}`))
    const clear = Object.assign(document.createElement('button'), { type: 'button', className: 'clear', textContent: 'clear', onclick: () => choose({ q: '', mode: '', heard: '' }) })
    found.replaceChildren(...pieces, clear)
  }
  drawSongs()
}

/** Chooses in the search: the address remembers it, the list starts again from the top, and filters are counted again. */
function choose(changes) {
  if ('q' in changes) changes = { ...changes, q: String(changes.q ?? '').trim() }
  Object.assign(search, changes)
  if (searchInput && 'q' in changes && document.activeElement !== searchInput) searchInput.value = search.q
  if (searchFilters && (search.mode || search.heard)) searchFilters.open = true
  const address = new URLSearchParams(location.search)
  for (const key of ['q', 'mode', 'heard']) search[key] ? address.set(key, search[key]) : address.delete(key)
  const query = address.toString()
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`)
  Object.assign(received, { total: undefined, rows: [], asked: new Set(), at: Date.now() })
  firstShown = 0
  loadOptions()
}
let typingSearch
searchInput?.addEventListener('input', () => {
  clearTimeout(typingSearch)
  const next = searchInput.value.trim()
  typingSearch = setTimeout(() => {
    if (next !== search.q) choose({ q: next })
  }, 180)
})
searchFilters?.addEventListener('toggle', () => drawSongs())
document.getElementById('search-mode').addEventListener('change', (event) => choose({ mode: event.target.value }))
document.getElementById('search-heard').addEventListener('change', (event) => choose({ heard: event.target.value }))
document.getElementById('song-search').addEventListener('submit', (event) => {
  event.preventDefault()
  clearTimeout(typingSearch)
  const next = (searchInput?.value ?? '').trim()
  if (next !== search.q) choose({ q: next })
})

async function loadPage(page) {
  const size = pageRows()
  if (page < 0 || (received.total !== undefined && page * size >= received.total)) return
  const query = searchQuery()
  const key = `${size}:${page}:${query}`
  if (received.asked.has(key)) return
  received.asked.add(key)
  try {
    const found = await fetch(`${radio}/songs/page?offset=${page * size}&count=${size}${query}`).then((r) => r.json())
    // a page asked for before the search changed is not this search's
    if (query !== searchQuery()) return
    const counted = received.total
    received.total = found.total
    if (counted !== found.total && searching) drawSearch()
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
  // the Song on now is not looked back on: it is where the receiver tunes in live.
  // Only the Radio knows which is on; when the song holds its breath, none is,
  // and the newest is a Song like any other, to be played from its beginning
  const latest = index === 0 && song.on === true && !search.q
  const about = song.mood ? `${song.mood.join(' + ')} · ${Math.round(song.seconds / 60)} min${song.on && search.q ? ' · live' : ''}` : '…'
  // a Song is linked by the name it was given; a Song with no name is not linked
  const link = Object.assign(document.createElement('a'), latest ? { href: '/' } : song.slug && { href: `/s/${song.song}/${song.slug}` })
  link.append(document.createTextNode(latest ? 'tune to live' : song.name ?? `Song ${number(song.song)}`))
  link.append(span('mood', `Song ${number(song.song)} · ${about}`))
  item.append(link)
  return item
}

function drawSongs() {
  if (!songsDialog.open) return
  // rows fetched for another search, or before the Radio said it could search, are not these
  if (received.query !== searchQuery()) Object.assign(received, { total: undefined, rows: [], asked: new Set(), query: searchQuery() })
  const size = pageRows()
  const total = received.total ?? 0
  const list = document.getElementById('song-list')
  document.getElementById('song-window').style.height = `${size * rowPx}px`
  firstShown = Math.max(0, Math.min(firstShown, Math.max(0, total - size)))
  if (received.total === 0) {
    const nothing = search.q ? 'no Song received matches that' : searchQuery() ? 'no Song received was heard that way' : 'nothing received yet'
    list.replaceChildren(Object.assign(document.createElement('li'), { className: 'unknown', textContent: nothing }))
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
  if (event.target?.matches?.('input, select, textarea')) return
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
  loadOptions()
})
document.getElementById('close-songs').addEventListener('click', () => songsDialog.close())

// A Song asked for by its name, at /s/<its number>/<the slug its name makes>,
// is played from its beginning. The Radio serves it only when the slug is the
// Song's; a Song is never asked for by its number alone.
const replayAt = (path) => {
  // the address says a slug's letters by percent signs (silicon-serenade%C2%B2); the slug is what they spell
  let said = path
  try {
    said = decodeURIComponent(path).normalize('NFC')
  } catch {}
  const asked = /^\/s\/([1-9]\d{0,399})\/([\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}\-]{0,399})$/u.exec(said)
  return asked ? { index: BigInt(asked[1]), number: BigInt(asked[1]).toLocaleString('en'), slug: asked[2] } : undefined
}
const playlistAt = (path) => {
  const asked = /^\/p\/([0-9a-z]{2,512})$/.exec(path)
  return asked ? { slug: asked[1] } : undefined
}
let replay = replayAt(location.pathname)
let playlist = replay ? undefined : playlistAt(location.pathname)
// A visit is the page's first entry being a Song's page: only then is the Song's
// intro heard. Everything after the first entry, carrying on, the back button,
// live, is not a visit, whatever address it lands on.
// `?intro=0` leaves the intro out, for a capture of the Song's sound alone (packages/marketing)
// a page that carries on after an update has no use for an intro: it is not a visit
const resuming = takeResume()
const introOff = new URLSearchParams(location.search).get('intro') === '0' || resuming
let entry = Boolean(replay) && !introOff

// Carrying on (plan "Carry on listening"). A Song heard again ends, and the
// listener may carry on: to the next Song that aired, and the next, until
// the song is live again, or straight to live. It is all taken up within
// this page, on the same sound, because a browser lets a page sound only
// after a click, and a page loaded again would have to be clicked again. The
// address follows what is heard, so it can still be shared, and the back
// button returns to the Song before. Autoplay, carrying on without being
// asked, is remembered in this browser until it is turned off.
const autoplayKey = 'ikuradio:autoplay'
function autoplaying() {
  try {
    return localStorage.getItem(autoplayKey) === 'on'
  } catch {
    return false
  }
}
function setAutoplay(on) {
  try {
    if (on) localStorage.setItem(autoplayKey, 'on')
    else localStorage.removeItem(autoplayKey)
  } catch {
    // a browser that keeps nothing still carries on for as long as the page is open
  }
  autoplayOn = on
  drawAutoplay()
}
let autoplayOn = autoplaying()

/** The knob's toggle: shown on single-Song and playlist pages (on a playlist, autoplay loops it; live always carries on). */
function drawAutoplay() {
  const toggle = document.getElementById('autoplay')
  toggle.hidden = !replay && !playlist
  toggle.setAttribute('aria-pressed', String(autoplayOn))
  toggle.textContent = autoplayOn ? 'autoplay ✓' : 'autoplay'
}
document.getElementById('autoplay').addEventListener('click', () => setAutoplay(!autoplayOn))

/** What the page says of the Song or playlist it will play from its beginning, or of live. */
let titled = true // the Radio titled the page it served
function tellReplay() {
  document.getElementById('play').textContent = playlist ? 'play playlist' : replay ? 'play song' : 'tune to live'
  const offered = document.getElementById('offered')
  // the Radio wrote the number and the name of the Song (or playlist summary) it served the page for;
  // a Song taken up in this page is told its number, and its name when known
  if (!offered.hasAttribute('data-served')) {
    offered.textContent = playlist
      ? playlist.items?.length
        ? `Playlist · ${playlist.items.length} song${playlist.items.length === 1 ? '' : 's'}`
        : 'Playlist'
      : replay
        ? `Song ${replay.number}${replay.name ? ` · ${replay.name}` : ''}`
        : ''
  }
  offered.hidden = !replay && !playlist
  document.getElementById('live').hidden = !replay && !playlist
  // the Radio titled the served page; the page titles itself only after client navigation
  if (titled) titled = false
  else {
    document.title = playlist
      ? playlist.items?.length
        ? `Playlist · ${playlist.items.length} Song${playlist.items.length === 1 ? '' : 's'} · ikuradio`
        : 'Playlist · ikuradio'
      : replay
        ? replay.name
          ? `${replay.name} · ikuradio`
          : `Song ${replay.number} · ikuradio`
        : 'ikuradio'
  }
  drawAutoplay()
}
tellReplay()

// What is being listened to, once the page is switched on: its sound, where
// its words go, and the loops that keep it going, stopped when it carries on.
let listening
const loops = []
let generation = 0
function every(ms, then) {
  loops.push(setInterval(then, ms))
}
/** Stops whatever is being listened to, so something else may be taken up. */
function stopListening() {
  for (const loop of loops.splice(0)) clearInterval(loop)
  generation++
  bridgeEnds()
  rezzy.away()
  document.querySelectorAll('#output .dj').forEach((node) => node.remove())
  // abandon any preloads still in flight so they never leak into `songs` after switching modes
  if (preloading) {
    const abandoned = preloading
    preloading = undefined
    abandoned.ready.then((r) => r?.prepared && songs.delete(r.prepared.place))
  }
  if (preloadingPlaylist) {
    const abandoned = preloadingPlaylist
    preloadingPlaylist = undefined
    abandoned.ready.then((r) => r?.first && songs.delete(r.first.place))
  }
  // stop any audio already playing or scheduled on the Web Audio clock with a brief click-free fade
  stopAllSounds(listening?.audioContext)
  songs.clear()
  // what it would have let go is gone with the Songs
  queued.archive = false
  showing = undefined
  // the details, structure, and offered line the Radio wrote were of the Song it served for
  document.getElementById('details').removeAttribute('data-served')
  document.getElementById('parts')?.removeAttribute('data-served')
  document.getElementById('offered').removeAttribute('data-served')
  tellDetails()
}

/** Takes up Song `n` from its beginning, in this page, at the link its name makes. */
function carryOnTo(n, slug, name, { push = true } = {}) {
  stopListening()
  playlist = undefined
  const at = `/s/${n}/${slug}`
  replay = { ...replayAt(at), name }
  if (push) history.pushState(null, '', at)
  tellReplay()
  listenAgain(listening.output, listening.audioContext)
}

/** Takes up a playlist at `/p/<slug>`, playing every Song in order seamlessly. */
function carryOnToPlaylist(slug, { push = true } = {}) {
  stopListening()
  replay = undefined
  playlist = { slug }
  if (push) history.pushState(null, '', `/p/${slug}`)
  tellReplay()
  listenPlaylist(listening.output, listening.audioContext)
}

/** Takes up live, in this page. */
function tuneLive({ push = true } = {}) {
  stopListening()
  replay = undefined
  playlist = undefined
  if (push) history.pushState(null, '', '/')
  tellReplay()
  listenLive(listening.output, listening.audioContext)
}

/** Carries on after Song `song`: with the next Song that aired after it, or with live. */
async function carryOn(song) {
  const mine = generation
  waiting('finding the next Song')
  try {
    const after = await fetch(`${radio}/songs/after?song=${song}`).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json()
    })
    if (mine !== generation) return
    if (after.song) carryOnTo(after.song, after.slug, after.name)
    else tuneLive()
  } catch {
    if (mine !== generation) return
    offerToCarryOn(song)
  }
}

/** A Song heard again has ended, and the Radio has a new release: the page reloads at the Song it would carry on to, or where it is. */
async function updateAfter(song) {
  waiting('the receiver is being updated')
  if (autoplayOn) {
    const after = await fetch(`${radio}/songs/after?song=${song}`).then((r) => r.json()).catch(() => ({}))
    history.replaceState(null, '', after.song ? `/s/${after.song}/${after.slug}` : '/')
  }
  await reloadForUpdate()
}

/** Where a Song heard again has ended: two ways to carry on, in place of the hint. */
function offerToCarryOn(song) {
  const button = (words, then) => Object.assign(document.createElement('button'), { type: 'button', className: 'carry', textContent: words, onclick: then })
  document.getElementById('status').replaceChildren(
    button('autoplay next', () => {
      setAutoplay(true)
      carryOn(song)
    }),
    button('tune to live', () => tuneLive()),
  )
}

/** Where a playlist has ended: loop it with autoplay on, or tune to live. */
function offerToCarryOnPlaylist(slug) {
  const button = (words, then) => Object.assign(document.createElement('button'), { type: 'button', className: 'carry', textContent: words, onclick: then })
  document.getElementById('status').replaceChildren(
    button('autoplay again', () => {
      setAutoplay(true)
      carryOnToPlaylist(slug, { push: false })
    }),
    button('tune to live', () => tuneLive()),
  )
}

// the knob's way back to live is taken up in this page, once it is switched on
document.getElementById('live').addEventListener('click', (event) => {
  if (!listening) return
  event.preventDefault()
  showPanel(false)
  tuneLive()
})

// back and forward go to the Song, playlist, or live the address names
addEventListener('popstate', () => {
  const askedSong = replayAt(location.pathname)
  const askedList = askedSong ? undefined : playlistAt(location.pathname)
  if (!listening) {
    replay = askedSong
    playlist = askedList
    // the page's first entry was not this one
    entry = false
    tellReplay()
    revealPlay()
    return
  }
  if (askedList) carryOnToPlaylist(askedList.slug, { push: false })
  else if (askedSong) carryOnTo(String(askedSong.index), askedSong.slug, undefined, { push: false })
  else tuneLive({ push: false })
})

/**
 * Gets a Song heard again ready: asks the Radio whether it has been
 * received, and, if so, begins to prepare it: its Session, its Music, its
 * takes sung, a visit's intro said. Nothing here needs the page to be
 * switched on, so it may begin before the first click.
 */
async function readyReplay(index, visit) {
  const song = String(index)
  // the throats' engine and dictionary are fetched while the Radio and the Archive are asked
  openThroats()
  const tactus = await askRadio()
  // only what has been received may be heard again: nothing from the future
  const aired =
    tactus.playing?.song === song ||
    (await fetch(`${radio}/songs?before=${index + 1n}&count=1`)
      .then((r) => r.json())
      .then((found) => found.some((a) => a.song === song))
      .catch(() => false))
  if (!aired) return { aired: false }
  const airing = { song, session: new URL(`sessions/${song}.json`, tactus.archive).href, archive: tactus.archive, begins: Infinity, seconds: 0, visit }
  const prepared = prepare(airing)
  // a hidden sign for whatever films the page: everything is fetched and the Song may begin
  Promise.all([prepared.starting, prepared.preparing]).then(() => prepared.startable && (document.body.dataset.ready = 'yes'))
  return { aired: true, tactus, airing, prepared }
}

/** Fetches a playlist's metadata and begins preloading its first Song before the play click. */
async function readyPlaylist(slug) {
  openThroats()
  const response = await fetch(`${radio}/p/${slug}.json`, { cache: 'no-store' })
  if (!response.ok) return { found: false }
  const data = await response.json()
  const items = Array.isArray(data?.songs) ? data.songs : []
  if (!items.length) return { found: false }
  window.space?.tune(items[0].song)
  const airing = {
    song: items[0].song,
    session: items[0].session,
    archive: data.archive,
    begins: Infinity,
    seconds: items[0].seconds || 0,
    slot: 0,
    visit: false,
  }
  const first = prepare(airing)
  return { found: true, archive: data.archive, items, first }
}

// A page that is opened at a Song or playlist begins to ready it at once, before anything
// is clicked, so that it is ready sooner when it is. Only the page at
// `/` waits for the click: it has nothing yet to ready.
// ?time=<seconds> is a look at the page, held still: nothing is readied until the Song is played
const looking = new URLSearchParams(location.search).has('time')
// a Song's own page has the space of its Song from the first moment, before it is played
if (replay) addEventListener('DOMContentLoaded', () => window.space?.tune(String(replay.index)))
let preloading = replay && !looking ? { song: String(replay.index), ready: readyReplay(replay.index, !introOff).catch(() => undefined) } : undefined
let preloadingPlaylist = playlist && !looking ? { slug: playlist.slug, ready: readyPlaylist(playlist.slug).catch(() => undefined) } : undefined

/**
 * Hidden signs for whatever films the page (packages/marketing): `started` when the
 * front page has gone and the page is sounding, `finished` when what is filmed is over,
 * just before the page shows anything after it. They change nothing in the page.
 */
const announce = (name) => dispatchEvent(new CustomEvent(`ikuradio:${name}`))

// Promo (hidden): a Song's own address with `?promo=<seconds>` is a page to be
// screen-recorded as a short film. The clock starts at the click. The Song
// begins with its intro as a visit does, and at `seconds` minus `outro` the
// sound and the words fade out together, and the promo view comes up, to
// stay: no autoplay, no links, nothing to press.
// `?promo=<seconds>` (twenty or more) is a promo, as above. `?promo=0` is a capture of the Song
// as it is, whole: the same page, with nothing in it that could come between a recording and
// the Song (the Radio is not asked again, the Songs are not listed, an update does not
// reload it), and no fade out: when the Song has ended, the page says so (`finished`) and rests.
const promoLength = (() => {
  const asked = new URLSearchParams(location.search).get('promo')
  if (!replay || asked === null) return undefined
  const seconds = Number(asked)
  return seconds === 0 || (Number.isFinite(seconds) && seconds >= 20) ? seconds : undefined
})()
const capturing = promoLength !== undefined
/** A promo, which has a length, and so a brief intro and an outro. */
const shortened = promoLength > 0
const outroSeconds = 4
// What a promo does to Rezzy's introduction, for it to be short: the speech is said this much
// faster, is cut after the sentence that reaches this many syllables, begins this many seconds
// into the intro, and the Song begins this many seconds after it ends.
const briefIntro = { speed: 1.25, syllables: 36, lead: 0.6, tail: 1 }
/** The first sentences of a speech, as many as fit `briefIntro.syllables`; the first always. */
function briefly(text) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text]
  const syllables = (s) => (s.match(/[aeiouy]+/gi) ?? []).length
  let kept = ''
  let count = 0
  for (const sentence of sentences) {
    count += syllables(sentence)
    if (kept && count > briefIntro.syllables) break
    kept += sentence
  }
  return kept.trim()
}
if (capturing) document.body.classList.add('promo')
let promoClock // when the click began the promo, in ms
let promoPhase = 0 // 0 playing, 1 fading out, 2 the promo view

/** Steps the promo; true once it has taken over from the Song. */
function promoStep(audioContext, songOver) {
  const spent = (Date.now() - promoClock) / 1000
  if (promoPhase === 0 && (songOver || spent >= promoLength - outroSeconds)) {
    promoPhase = 1
    const level = audioContext.currentTime
    master?.gain.setValueAtTime(master.gain.value, level)
    master?.gain.linearRampToValueAtTime(0, level + outroSeconds)
    document.body.classList.add('outro')
    promoOutAt = Date.now() + outroSeconds * 1000
  }
  // the promo view comes up in the middle of the fade out, and its address flashes in the last second
  if (promoPhase === 1) {
    if (Date.now() >= promoOutAt - (outroSeconds / 2) * 1000) document.body.classList.add('promoted')
    if (Date.now() >= promoOutAt - 1000) document.body.classList.add('flash')
  }
  if (promoPhase === 1 && Date.now() >= promoOutAt) {
    promoPhase = 2
    for (const loop of loops.splice(0)) clearInterval(loop)
    audioContext.suspend().catch(() => {})
    announce('finished')
  }
  return promoPhase > 0
}
let promoOutAt = 0

async function listenAgain(output, audioContext) {
  const mine = generation
  const { index, number: named } = replay
  const song = String(index)
  const visit = entry
  entry = false
  // what was readied before the click, if it is this Song; any other is let go
  const early = preloading
  preloading = undefined
  let ready
  if (early?.song === song) ready = await early.ready
  else early?.ready.then((r) => r?.prepared && songs.delete(r.prepared.place))
  ready ??= await readyReplay(index, visit).catch(() => undefined)
  if (mine !== generation) return
  if (!ready) {
    weather(output, 'the radio is quiet')
    return
  }
  if (!ready.aired) {
    weather(output, `Song ${named} has not been received yet`)
    waiting('tune to live from the knob')
    return
  }
  const { tactus, airing, prepared } = ready
  every(200, () => {
    // throats already open from a Song before are idle, and are asked to sing this one's first takes
    singSoon()
    // a DJ with something to say walks on while the Song is still readying
    if (prepared.intro?.coming) rezzy.comeIn()
    if (!prepared.startable) waiting(`readying Song ${named}: ${prepared.fetched} of ${prepared.first || '…'} to begin with`)
  })
  await prepared.starting
  if (mine !== generation) return
  for (const loop of loops.splice(0)) clearInterval(loop)
  if (!prepared.startable) {
    weather(output, `Song ${named} cannot be found in the Archive`)
    offerToCarryOn(song)
    return
  }
  airing.seconds = prepared.session.seconds
  // a Song with no speech to introduce it has no use for Rezzy, who was in place for the promo
  if (capturing && !prepared.intro?.speech) rezzy.away()
  // a visit hears the Song's intro first, which lies before its moment 0, and begins
  // when the DJ, if there is one, is in position
  const arrives = prepared.intro?.speech ? rezzy.comeIn() : 0
  airing.begins = Math.max(now() + 1500, arrives + 500) + (prepared.intro?.seconds ?? 0) * 1000
  // heard again, the page still asks, so it learns when it is out of date
  if (!capturing) every(5000, () => askRadio().catch(() => {}))
  let ended = false
  every(50, () => {
    placeSounds(audioContext)
    singSoon()
    const t = (now() - airing.begins) / 1000
    if (shortened && promoStep(audioContext, t >= airing.seconds)) return
    const said = tellIntro(prepared, t)
    if (t < 0) return waiting(said ?? `Song ${named} begins in ${Math.ceil(-t)}s`)
    if (t < airing.seconds) {
      writeUpTo(output, prepared, t)
      if (prepared.missing && t < 6) waiting('its voices were lost; only its words remain')
      return
    }
    if (ended) return
    ended = true
    announce('finished')
    if (capturing) return
    bridgeEnds()
    weather(output, `Song ${named} has ended`)
    // a Radio that has moved on is taken up now; where the page lands is the Song it would have carried on to
    if (queued.radio) return updateAfter(song)
    if (autoplayOn) carryOn(song)
    else offerToCarryOn(song)
  })
}

// Listening, for as long as the page is open. Every few seconds the Radio is
// asked what plays and what comes; many times a second, the page catches up
// with the Tactus. If the Radio cannot be reached, the page goes on with
// what it already has, and asks again.
const quiet = '~ the radio is quiet ~'
const breath = '~ the song holds its breath ~'

/**
 * Plays every Song in `playlist` seamlessly in order: no pause or bottom
 * navigation buttons between Songs. When the last Song finishes, `autoplayOn`
 * loops the playlist seamlessly back to Track 1; otherwise end-of-playlist
 * CTAs (`autoplay again` and `tune to live`) are offered.
 */
async function listenPlaylist(output, audioContext) {
  const mine = generation
  const slug = playlist?.slug
  if (!slug) return
  const early = preloadingPlaylist
  preloadingPlaylist = undefined
  let loaded
  if (early?.slug === slug) loaded = await early.ready
  else early?.ready.then((r) => r?.first && songs.delete(r.first.place))
  loaded ??= await readyPlaylist(slug).catch(() => undefined)
  if (mine !== generation) {
    if (loaded?.first) songs.delete(loaded.first.place)
    return
  }
  if (!loaded || !loaded.found) {
    weather(output, 'this playlist cannot be found')
    waiting('tune to live from the knob')
    return
  }
  const { archive, items, first } = loaded
  playlist = { slug, items, at: 0 }
  tellReplay()

  // monotonic slot index `idx` (`item = items[idx % items.length]`) so looping never reuses a slot key
  const slots = new Map([[0, first]])
  const posOf = (idx) => idx % items.length
  const itemOf = (idx) => items[posOf(idx)]
  const isLastInPass = (idx) => posOf(idx) === items.length - 1

  const prepareSlot = (idx, begins) => {
    if (idx < 0) return undefined
    const existing = slots.get(idx)
    if (existing) return existing
    const item = itemOf(idx)
    const airing = {
      song: item.song,
      session: item.session,
      archive,
      begins,
      seconds: item.seconds || 0,
      slot: idx,
      visit: false,
    }
    const created = prepare(airing)
    slots.set(idx, created)
    return created
  }

  let current = 0
  // find the first playable Song in the playlist
  while (current < items.length) {
    const slot = prepareSlot(current, Infinity)
    every(200, () => {
      singSoon()
      if (!slot.startable) {
        waiting(`readying Song ${number(itemOf(current).song)} (${posOf(current) + 1} of ${items.length}): ${slot.fetched} of ${slot.first || '…'}`)
      }
    })
    await slot.starting
    if (mine !== generation) return
    for (const loop of loops.splice(0)) clearInterval(loop)
    if (slot.startable) break
    current++
  }
  if (current >= items.length) {
    weather(output, 'none of the Songs in this playlist could be found')
    waiting('tune to live from the knob')
    return
  }

  const startSlot = (idx, beginsAt) => {
    const slot = slots.get(idx)
    slot.airing.seconds = slot.session.seconds
    // never shift begins after audio has already been placed for this slot
    if (!(slot.placed?.size > 0)) slot.airing.begins = beginsAt
    playlist.at = posOf(idx)
    // preload the next Song in this pass, or Track 1 of the next pass when looping with autoplay
    if (!isLastInPass(idx) || autoplayOn) {
      prepareSlot(idx + 1, slot.airing.begins + slot.airing.seconds * 1000)
    }
  }

  const forgetPastSlots = (moment) => {
    for (const [idx, past] of slots) {
      if (idx >= current) continue
      const ends = past.airing.begins + past.airing.seconds * 1000
      if (moment - ends > 30_000) {
        songs.delete(past.place)
        slots.delete(idx)
      }
    }
  }

  const finishPlaylist = () => {
    if (ended) return
    ended = true
    announce('finished')
    bridgeEnds()
    weather(output, 'playlist ended')
    if (queued.radio) return reloadForUpdate()
    offerToCarryOnPlaylist(slug)
  }

  startSlot(current, now() + 1200)
  if (!capturing) every(5000, () => askRadio().catch(() => {}))
  let ended = false
  let skippedInRow = 0
  every(50, () => {
    const moment = now()
    // resolve any completed track handoff BEFORE placing sounds or singing takes so delayed slots never desync or deadlock
    while (!ended) {
      const active = slots.get(current)
      if (!active || !songs.has(active.place)) {
        skippedInRow++
        if (skippedInRow >= items.length || (isLastInPass(current) && !autoplayOn)) {
          finishPlaylist()
          break
        }
        current++
        prepareSlot(current, Infinity)
        continue
      }
      if (!active.startable) {
        // active track (after a skip) is still loading: wait without placing sounds or dropping takes
        if (Number.isFinite(active.airing.begins) && !(active.placed?.size > 0)) active.airing.begins = Infinity
        waiting(`readying Song ${number(itemOf(current).song)} (${posOf(current) + 1} of ${items.length}): ${active.fetched} of ${active.first || '…'}`)
        singSoon()
        forgetPastSlots(moment)
        return
      }
      if (!Number.isFinite(active.airing.begins)) {
        skippedInRow = 0
        startSlot(current, moment + 150)
        break
      }
      const endsAt = active.airing.begins + active.airing.seconds * 1000
      // keep loop-next preloading in sync if the listener toggles autoplay during the final track
      if (isLastInPass(current)) {
        if (autoplayOn && !queued.radio) {
          prepareSlot(current + 1, endsAt)
        } else {
          const pre = slots.get(current + 1)
          if (pre && !(pre.placed?.size > 0)) {
            songs.delete(pre.place)
            slots.delete(current + 1)
          }
        }
      }
      if (moment < endsAt) break
      // active track ended: advance within pass, loop if autoplayOn, or offer end-of-playlist CTAs
      if (isLastInPass(current)) {
        if (!autoplayOn) {
          finishPlaylist()
          break
        }
        if (queued.radio) {
          ended = true
          reloadForUpdate()
          return
        }
      }
      const nextIdx = current + 1
      const next = prepareSlot(nextIdx, endsAt)
      if (!songs.has(next.place)) {
        // next track's Session failed to load; skip directly past it
        skippedInRow++
        if (skippedInRow >= items.length) {
          finishPlaylist()
          break
        }
        current = nextIdx
        continue
      }
      if (next.startable) {
        skippedInRow = 0
        current = nextIdx
        const delayed = !(next.placed?.size > 0) && (!Number.isFinite(next.airing.begins) || moment - next.airing.begins > 1000)
        startSlot(current, delayed ? moment + 150 : next.airing.begins)
        break
      }
      // still buffering past endsAt: hold begins at Infinity so singSoon prioritizes takes without dropping them
      if (Number.isFinite(next.airing.begins) && !(next.placed?.size > 0)) next.airing.begins = Infinity
      waiting(`readying Song ${number(itemOf(nextIdx).song)} (${posOf(nextIdx) + 1} of ${items.length}): ${next.fetched} of ${next.first || '…'}`)
      singSoon()
      forgetPastSlots(moment)
      return
    }

    placeSounds(audioContext)
    singSoon()
    forgetPastSlots(moment)
    if (ended) return
    const active = slots.get(current)
    if (!active?.session) return
    const t = (now() - active.airing.begins) / 1000
    if (t < 0) return waiting(`Song ${number(active.airing.song)} (${posOf(current) + 1} of ${items.length}) begins in ${Math.ceil(-t)}s`)
    writeUpTo(output, active, t)
    if (active.missing && t < 6) waiting('its voices were lost; only its words remain')
  })
}

/** The first click: the page may sound from now on, and takes up the playlist, Song asked for, or live. */
async function listen() {
  promoClock = Date.now()
  // a promo's recording begins here: Rezzy is already in place, not walking on from an empty screen
  if (capturing && !introOff) rezzy.comeIn(true)
  document.getElementById('controls').style.display = 'none'
  announce('started')
  listening = { output: document.getElementById('output'), audioContext: new AudioContext() }
  // the first page of Songs comes with the first Song, so the dialog opens full
  received.at = Date.now()
  if (!capturing) loadPage(0)
  if (playlist) return listenPlaylist(listening.output, listening.audioContext)
  if (replay) return listenAgain(listening.output, listening.audioContext)
  return listenLive(listening.output, listening.audioContext)
}

async function listenLive(output, audioContext) {
  const mine = generation
  let said // the last thing said into the quiet, so it is said only once
  let heard = false

  const ask = async () => {
    try {
      const tactus = await askRadio()
      if (mine !== generation) return
      heard = true
      for (const airing of [tactus.playing, tactus.next]) if (airing) prepare(airing)
      forget()
    } catch {
      if (said !== quiet) weather(output, quiet.slice(2, -2))
      said = quiet
    }
  }
  await ask()
  if (mine !== generation) return
  every(5000, ask)

  every(50, () => {
    placeSounds(audioContext)
    singSoon()
    // an update queued is taken when the Song has stopped, and nothing new is begun until it is
    if (takeUpdate(ask)) return
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
  })
}

/** Reveals the play button once the page is ready for this route, retiring the preparing animation. */
function revealPlay() {
  const prep = document.getElementById('preparing')
  if (prep) prep.hidden = true
  document.getElementById('play').hidden = false
}

document.getElementById('play').addEventListener('click', () => listen())

if (preloadingPlaylist) {
  const waitingSlug = preloadingPlaylist.slug
  Promise.race([preloadingPlaylist.ready, new Promise((resolve) => setTimeout(resolve, 4000))])
    .then((res) => {
      if (res?.found && playlist?.slug === waitingSlug && !playlist.items) playlist.items = res.items
    })
    .finally(() => {
      if (playlist?.slug === waitingSlug) {
        tellReplay()
        revealPlay()
      }
    })
} else {
  revealPlay()
}

// a page reloaded for an update carries on listening by itself. Where the browser will not sound without
// a touch, it listens in silence and says so, and sounds at the first touch.
if (resuming && !capturing && !looking) {
  listen().then(() => {
    const context = listening?.audioContext
    context?.resume?.().catch(() => {})
    setTimeout(() => {
      if (!context || context.state === 'running') return
      waiting('touch the screen to hear the receiver')
      const wake = () => context.resume().then(() => context.state === 'running' && ['pointerdown', 'keydown'].forEach((name) => removeEventListener(name, wake)))
      for (const name of ['pointerdown', 'keydown']) addEventListener(name, wake)
    }, 1000)
  })
}
