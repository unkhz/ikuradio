// The Heart: the loop that keeps the song breathing.
//
// It lives beside the Studio, on the machine with the GPU, and nowhere
// else, though it is not the Studio: the Studio makes a Song and ends; the
// Heart goes on. It opens no door and answers nobody. It only listens: to the
// Archive, for the Songs that are ready, and to the live Radio, for the
// Song being played. When too few Songs are waiting ahead of it, it calls a
// Studio, one at a time, and the Studio makes a Song and leaves it in the
// Archive. When enough Songs wait, the slack between Songs is spent on the
// intros of Songs that have aired and have none, new and old (plan "Intro
// with Rezzy"): a short run, a few intros at a time, that gives way at once
// when a Studio is wanted.
//
// If the Heart stops, nothing breaks. The Radio plays what it has, and
// then holds its breath, and the song stops breathing until the Heart is
// started again. Then it carries on from its diary.
//
//   bun run heart

import { spawn, type ChildProcess } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getEnv } from 'tools'
import { archiveAddress, paths, type ArchiveIndex } from 'archive'
import { liveReached, waitingAfter, type Told } from './lib/beat.js'

const { RADIO_URL, SONGS_AHEAD } = getEnv()
/** The Studio beside the Heart, where it is called in. */
const studioHome = fileURLToPath(new URL('../studio/', import.meta.url))
const archive = archiveAddress()

async function read<T>(url: URL): Promise<T | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    return response.ok ? ((await response.json()) as T) : undefined
  } catch {
    return undefined
  }
}

/**
 * The last Song the Radio has reached: the live one playing, or the one it
 * has announced, or else the last one that aired, an encore being none of
 * them. Undefined if the Radio cannot be heard; null if it has never played
 * anything.
 */
async function reached(): Promise<string | null | undefined> {
  const tactus = await read<{ playing: Told; next: Told }>(new URL('tactus', RADIO_URL))
  if (!tactus) return undefined
  const now = liveReached(tactus)
  if (now !== undefined) return now
  const [last] = (await read<Told[]>(new URL('songs?count=1', RADIO_URL))) ?? []
  return last?.song ?? null
}

/** Where the Studio's words are kept, so that a Studio that falls leaves word of why. */
const studioLog = 'memory/studio.log'
/** Where the run that makes intros keeps its words. */
const introLog = 'memory/intro.log'

function keep(child: ChildProcess, file = studioLog, who = 'the Studio') {
  mkdirSync('memory', { recursive: true })
  if (existsSync(file)) renameSync(file, `${file}.1`)
  const log = createWriteStream(file)
  child.stdout?.on('data', (data) => {
    process.stdout.write(data)
    log.write(data)
  })
  child.stderr?.on('data', (data) => {
    process.stderr.write(data)
    log.write(data)
  })
  child.on('exit', (code) => log.end(`${who} ended (${code})\n`))
}

/** The Studio at work, or the run that makes intros: one of them at a time, so the GPU and the mind are never asked for twice. */
let studio: ChildProcess | undefined
/** Until when the Heart asks for no more intros, because none was needed or the last run fell. */
let introsRestUntil = 0
let resting = false
let deaf = false
/**
 * Whether a beat is listening now. A beat waits on the Archive and the Radio
 * before it calls a Studio, and the beats come both from the clock and after
 * a Studio ends; two of them listening at once would both find no Studio at
 * work, and both call one. Two Studios writing one diary make the same Song
 * twice. So a beat that finds another listening lets it be.
 */
let listening = false

/** One beat: listen, and call a Studio if too few Songs are waiting. */
async function beat() {
  if (resting || studio || listening) return
  listening = true
  try {
    await listen()
  } finally {
    listening = false
  }
}

async function listen() {
  const [index, radio] = await Promise.all([
    read<ArchiveIndex>(new URL(paths.index, archive)),
    reached(),
  ])
  if (resting || studio) return
  if (radio === undefined) {
    if (!deaf) console.warn(`the Radio cannot be heard at ${RADIO_URL}; the Heart waits for it`)
    deaf = true
    return
  }
  if (deaf) console.log('the Radio can be heard again')
  deaf = false
  const waiting = waitingAfter(index?.songs ?? [], radio)
  if (waiting >= SONGS_AHEAD) {
    // enough Songs wait: the slack is for the intros of Songs that have aired
    if (Date.now() >= introsRestUntil) makeIntros()
    return
  }
  console.log(`${waiting} Songs waiting, ${SONGS_AHEAD} wanted: the Studio is called in`)
  const called = spawn('bun', [`${studioHome}index.ts`], { cwd: studioHome, stdio: ['ignore', 'pipe', 'pipe'] })
  studio = called
  // what the Studio says is heard here, and kept: the last Studio's words in
  // studio.log, the one before it in studio.log.1
  keep(called)
  called.on('exit', (code) => {
    if (code) console.warn(`the Studio stopped (${code})`)
    // only the Studio at work frees the Heart to call another
    if (studio === called) studio = undefined
    // a Studio that made its Song may not be the last one needed
    if (!resting) setTimeout(beat, code ? 30_000 : 0)
  })
}

/**
 * Calls in the run that makes intros, in the slack between Songs. It makes a
 * few at a time and ends: with 0, when it made some or a Studio was wanted, and
 * the Heart listens again at once; with 3, when no Song needs one, and the Heart
 * does not ask again for ten minutes; with anything else it fell, and the
 * Heart waits a minute.
 */
function makeIntros() {
  console.log('enough Songs wait: the slack is for intros')
  const called = spawn('bun', [`${studioHome}intro.ts`], { cwd: studioHome, stdio: ['ignore', 'pipe', 'pipe'] })
  studio = called
  keep(called, introLog, 'the run that makes intros')
  called.on('exit', (code) => {
    if (code === 3) introsRestUntil = Date.now() + 10 * 60_000
    else if (code) {
      console.warn(`the run that makes intros stopped (${code})`)
      introsRestUntil = Date.now() + 60_000
    }
    if (studio === called) studio = undefined
    if (!resting) setTimeout(beat, code === 0 ? 0 : 30_000)
  })
}

/**
 * Asked to rest, the Heart calls no more Studios, but lets the one at work
 * finish its Song: a Song half made would leave half of itself in the
 * diary. Asked again, it stops at once.
 */
function rest(signal: NodeJS.Signals) {
  if (resting) {
    studio?.kill(signal)
    process.exit(0)
  }
  resting = true
  if (!studio) {
    console.log(`The Heart rests (${signal}). The song breathes again when it is started.`)
    process.exit(0)
  }
  console.log(`The Heart rests (${signal}) once the Song in hand is made.`)
  studio.on('exit', () => {
    console.log('The Song in hand is made, and the Heart rests.')
    process.exit(0)
  })
}
process.on('SIGTERM', () => rest('SIGTERM'))
process.on('SIGINT', () => rest('SIGINT'))

console.log(`The Heart beats: the Archive at ${archive}, the Radio at ${RADIO_URL}`)
await beat()
setInterval(beat, 30_000)
