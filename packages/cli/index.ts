// A Receiver in a terminal. Like the page, it asks the Radio for the Tactus,
// fetches each coming Song whole from the Archive before it begins, its
// Session and every Recording, into a folder of its own, sings every voice
// that came as a take with the page's own throat (in a Worker, as the page
// does), and then plays it: the voices and the Music through ffplay, each at
// its moment, and the words typed as they are sung.
//
//   bun run listen

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { play } from 'vocals'
import { getEnv } from 'tools'
import { levelOf, paths, type Session, type SessionTake } from 'archive'
import { placements } from './lib/time.js'

// the live Radio, wherever it is: RADIO_URL
const { RADIO_URL: radio } = getEnv()

type Airing = { song: string; session: string; archive: string; begins: number; seconds: number }

// the Radio's clock, as this terminal knows it: the quickest answer is believed
const samples: { rtt: number; offset: number }[] = []
let offset = 0
const now = () => Date.now() + offset

async function askRadio(): Promise<{ playing: Airing | null; next: Airing | null }> {
  const sent = Date.now()
  const tactus = (await fetch(new URL('tactus', radio)).then((r) => r.json())) as {
    now: number
    playing: Airing | null
    next: Airing | null
  }
  const got = Date.now()
  samples.push({ rtt: got - sent, offset: tactus.now - (sent + got) / 2 })
  if (samples.length > 12) samples.shift()
  offset = samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset
  return tactus
}

// The throat: the page's own, from beside the page, in a Worker of its own so
// the words are typed on time while a take is sung
const page = new URL('../ui/public/', import.meta.url)
let throat: Promise<Worker> | undefined
const answers = new Map<number, (answer: { samples?: Float32Array; error?: string }) => void>()
let jobs = 0

function openThroat() {
  throat ??= (async () => {
    const engine = await Bun.file(new URL('throat/chimera.wasm', page)).arrayBuffer()
    const dictionary = gunzipSync(await Bun.file(new URL('throat/cmudict.txt.gz', page)).arrayBuffer()).toString()
    const worker = new Worker(new URL('throat-worker.js', page).href, { type: 'module' })
    await new Promise<void>((resolve, reject) => {
      worker.onmessage = ({ data }) => (data.opened ? resolve() : reject(new Error(data.error)))
      worker.postMessage({ open: { engine, dictionary } })
    })
    worker.onmessage = ({ data }) => {
      answers.get(data.job)?.(data)
      answers.delete(data.job)
    }
    return worker
  })()
  return throat
}

/** Sings a take into a WAV the size of its samples: mono, 32-bit float, at 48 kHz. */
async function singInto(file: string, take: SessionTake, body: string) {
  const worker = await openThroat()
  const job = jobs++
  const { samples, error } = await new Promise<{ samples?: Float32Array; error?: string }>((resolve) => {
    answers.set(job, resolve)
    worker.postMessage({ job, take, body })
  })
  if (!samples) throw new Error(error)
  await writeFile(file, wav(samples))
}

function wav(samples: Float32Array, rate = 48000) {
  const header = Buffer.alloc(44)
  const bytes = samples.length * 4
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + bytes, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(3, 20) // IEEE float
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 4, 28)
  header.writeUInt16LE(4, 32)
  header.writeUInt16LE(32, 34)
  header.write('data', 36)
  header.writeUInt32LE(bytes, 40)
  return Buffer.concat([header, Buffer.from(samples.buffer, samples.byteOffset, bytes)])
}

const shelf = await mkdtemp(join(tmpdir(), 'song-receiver-'))
type Song = { airing: Airing; session?: Session; dir: string; ready: boolean; placed: boolean; cursor?: Cursor }
const songs = new Map<string, Song>()

/** How many Recordings are fetched at once. */
const fetching = 6

async function prepare(airing: Airing) {
  if (songs.has(airing.song)) return
  const song: Song = { airing, dir: join(shelf, airing.song), ready: false, placed: false }
  songs.set(airing.song, song)
  try {
    song.session = (await fetch(airing.session).then((r) => r.json())) as Session
  } catch {
    // asked for again with the next Tactus
    songs.delete(airing.song)
    return
  }
  await mkdir(song.dir, { recursive: true })
  const session = song.session
  const queue = [...new Set(session.recordings.filter(({ take }) => !take).map(({ id }) => id))]
  // a few at a time, each asked for again, patiently, until it comes
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift()!
      for (let attempt = 0; songs.get(airing.song) === song; attempt++) {
        try {
          const response = await fetch(new URL(paths.recording(id), airing.archive))
          if (!response.ok) throw new Error(`${id}: ${response.status}`)
          await writeFile(join(song.dir, id), new Uint8Array(await response.arrayBuffer()))
          break
        } catch {
          await new Promise((resolve) => setTimeout(resolve, Math.min(10_000, 500 * 2 ** attempt)))
        }
      }
    }
  }
  // and the voices, sung here, each take once however often it is heard
  const singing = (async () => {
    const sung = new Set<string>()
    for (const { id, take, voice } of session.recordings) {
      if (!take || sung.has(id) || songs.get(airing.song) !== song) continue
      sung.add(id)
      const body = session.singers[voice ?? 0]?.body ?? 'female'
      await singInto(join(song.dir, id), take, body).catch((error) => {
        // a take that cannot be sung falls silent; the song goes on
        console.warn(`\na take could not be sung: ${error}`)
      })
    }
  })()
  await Promise.all([...Array.from({ length: fetching }, worker), singing])
  song.ready = songs.get(airing.song) === song
}

/** Starts every Recording of a Song at its moment, or where it would be by now. */
function place(song: Song) {
  song.placed = true
  const since = (now() - song.airing.begins) / 1000
  for (const { recording, after, from } of placements(song.session!.recordings, since)) {
    setTimeout(
      () =>
        play(join(song.dir, recording.id), {
          from,
          // every Recording brought to the loudness its kind should sound at
          gain: levelOf(recording),
          // each singer where a small choir would stand: the lead in the middle
          ...(recording.kind === 'voice' ? { pan: [0, -0.4, 0.4, -0.7][recording.voice ?? 0] ?? 0 } : {}),
          // a bed's tail fades out under what follows
          ...(recording.fade && recording.seconds !== undefined
            ? { fade: { at: recording.seconds, seconds: recording.fade } }
            : {}),
        }).catch(() => {
          // a recording that cannot be played is let go; the song goes on
        }),
      after * 1000,
    )
  }
}

type Cursor = { i: number; p: number; l: number; c: number }

/** Types the words up to the moment `t`, in seconds from the Song's beginning. */
function writeUpTo(song: Song, t: number) {
  const session = song.session!
  const say = (text: string) => process.stdout.write(text)
  if (!song.cursor) {
    say(`\n~ ${session.mood.join(' + ')} ~\n\n`)
    const i = Math.max(0, session.iterations.findLastIndex((it) => it.at <= t))
    song.cursor = { i, p: -1, l: 0, c: 0 }
  }
  const cursor = song.cursor
  for (;;) {
    const iteration = session.iterations[cursor.i]
    if (!iteration) return
    if (cursor.p < 0) {
      if (t < iteration.at) return
      process.title = `ikuradio, iteration ${BigInt(iteration.iteration)}`
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
      if (part.type === 'bridge') say('~\n\n')
      cursor.c = 0
    }
    const line = part.lines[cursor.l]
    if (!line) {
      if (part.lines.length) say('\n')
      cursor.p++
      cursor.l = 0
      cursor.c = -1
      continue
    }
    const since = (t - line.at) * 1000
    while (cursor.c < line.text.length && line.typing[cursor.c] <= since) {
      say(line.text[cursor.c])
      cursor.c++
    }
    if (cursor.c < line.text.length || line.typing[line.text.length] > since) return
    say('\n')
    cursor.l++
    cursor.c = 0
  }
}

async function ask() {
  try {
    const { playing, next } = await askRadio()
    for (const airing of [playing, next]) if (airing) void prepare(airing)
  } catch {
    // the Radio cannot be reached; the terminal goes on with what it has
  }
  for (const [name, song] of songs) {
    if (now() - (song.airing.begins + song.airing.seconds * 1000) > 30_000) {
      songs.delete(name)
      await rm(song.dir, { recursive: true, force: true })
    }
  }
}

await ask()
setInterval(ask, 5000)
setInterval(() => {
  const moment = now()
  for (const song of songs.values()) {
    const { begins, seconds } = song.airing
    if (!song.ready || moment < begins || moment >= begins + seconds * 1000) continue
    if (!song.placed) place(song)
    writeUpTo(song, (moment - begins) / 1000)
  }
}, 50)

const leave = async () => {
  await rm(shelf, { recursive: true, force: true })
  process.exit(0)
}
process.on('SIGINT', leave)
process.on('SIGTERM', leave)
