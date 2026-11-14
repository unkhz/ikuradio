// The Heart: the loop that keeps the song breathing.
//
// It lives beside the Studio, on the machine with the GPU, and nowhere
// else, though it is not the Studio: the Studio makes a Song and ends; the
// Heart goes on. It opens no door and answers nobody. It only listens: to the
// Archive, for the Songs that are ready, and to the live Radio, for the
// Song being played. When too few Songs are waiting ahead of it, it calls a
// Studio, one at a time, and the Studio makes a Song and leaves it in the
// Archive.
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
import { waitingAfter } from './lib/beat.js'

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

type Told = { song: string } | null

/**
 * The last Song the Radio has reached: the one playing, or the one it has
 * announced, or else the last one that aired. Undefined if the Radio cannot
 * be heard; null if it has never played anything.
 */
async function reached(): Promise<string | null | undefined> {
  const tactus = await read<{ playing: Told; next: Told }>(new URL('tactus', RADIO_URL))
  if (!tactus) return undefined
  const now = tactus.next?.song ?? tactus.playing?.song
  if (now !== undefined) return now
  const [last] = (await read<Told[]>(new URL('songs?count=1', RADIO_URL))) ?? []
  return last?.song ?? null
}

/** Where the Studio's words are kept, so that a Studio that falls leaves word of why. */
const studioLog = 'memory/studio.log'

function keep(child: ChildProcess) {
  mkdirSync('memory', { recursive: true })
  if (existsSync(studioLog)) renameSync(studioLog, `${studioLog}.1`)
  const log = createWriteStream(studioLog)
  child.stdout?.on('data', (data) => {
    process.stdout.write(data)
    log.write(data)
  })
  child.stderr?.on('data', (data) => {
    process.stderr.write(data)
    log.write(data)
  })
  child.on('exit', (code) => log.end(`the Studio ended (${code})\n`))
}

let studio: ChildProcess | undefined
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
  if (waiting >= SONGS_AHEAD) return
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
