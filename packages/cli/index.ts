// A Receiver in a terminal. Like the page, it asks the Radio for the Tactus,
// fetches each coming Song whole from the Archive before it begins, its
// Session and every Recording, into a folder of its own, and then plays it:
// the voices and the Music through ffplay, each at its moment, and the
// words typed as they are sung.
//
//   bun run listen

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { play } from 'vocals'
import { getEnv } from 'tools'
import { levelOf, paths, type Session } from 'archive'
import { placements } from './lib/time.js'

const { SERVER_HOST, SERVER_PORT } = getEnv()
const radio = `http://${SERVER_HOST}:${SERVER_PORT}/`

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

const shelf = await mkdtemp(join(tmpdir(), 'song-receiver-'))
type Song = { airing: Airing; session?: Session; dir: string; ready: boolean; placed: boolean; cursor?: Cursor }
const songs = new Map<string, Song>()

async function prepare(airing: Airing) {
  if (songs.has(airing.song)) return
  const song: Song = { airing, dir: join(shelf, airing.song), ready: false, placed: false }
  songs.set(airing.song, song)
  try {
    song.session = (await fetch(airing.session).then((r) => r.json())) as Session
    await mkdir(song.dir, { recursive: true })
    for (const id of new Set(song.session.recordings.map(({ id }) => id))) {
      const response = await fetch(new URL(paths.recording(id), airing.archive))
      if (!response.ok) throw new Error(`${id}: ${response.status}`)
      await writeFile(join(song.dir, id), new Uint8Array(await response.arrayBuffer()))
    }
    song.ready = true
  } catch {
    // asked for again with the next Tactus
    songs.delete(airing.song)
  }
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
      process.title = `Song that never ends, iteration ${BigInt(iteration.iteration) + 1n}`
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
