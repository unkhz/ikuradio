// The run that makes intros (plan "Intro with Rezzy"): the Songs that have aired
// and have no intro, newest first, a few at a time. The Heart calls it in the
// slack between Songs, when enough Songs wait and it has no Studio to call; it
// can be run by hand too. It stops at once if a Studio is wanted.
//
//   bun run intro                 make the intros of the next few Songs that need one
//   bun run intro --most 10       ...of the next ten
//   bun run intro --song 1100     ...of that Song, whether it has one or not: it is made again
//   bun run intro --song 1100,1101   ...of those Songs
//   bun run intro --list          tell which Songs need one, and make none
//
// It ends with 0 if it made an intro or yielded to a Studio, 3 if no Song needs
// one, and 1 if it fell. A Studio at work is let finish first.

import { openArchive, paths } from 'archive'
import { rezzy } from 'dj'
import { restBand, wakeBand } from 'music'
import { syllableCount, writeSpeech } from 'song'
import { getEnv, Sleeper } from 'tools'
import { loudnessOf } from 'vocals'
import { growIntro } from './lib/intro.js'
import { introduce, unintroduced, type Introducing } from './lib/introducing.js'
import { holdStudioFree, StudioBusy } from './lib/lock.js'

const { RADIO_URL, SONGS_AHEAD } = getEnv()
const args = process.argv.slice(2)
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const most = option('--most') ? Number(option('--most')) : (option('--song')?.split(',').length ?? 3)

// the Studio at work is let finish: this run keeps the mind and the band as a Studio does,
// and the two shall not at once
try {
  await holdStudioFree()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(error instanceof StudioBusy ? 75 : 1)
}

const { store, where } = openArchive()
const read = async <T>(url: URL): Promise<T | undefined> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    return response.ok ? ((await response.json()) as T) : undefined
  } catch {
    return undefined
  }
}
const tactus = await read<{ playing: { song: string } | null; next: { song: string } | null }>(new URL('tactus', RADIO_URL))
if (!tactus) {
  console.error(`the Radio cannot be heard at ${RADIO_URL}`)
  process.exit(1)
}
const playing = tactus.playing?.song
if (playing === undefined) {
  console.log('nothing has aired yet, so nothing needs an intro')
  process.exit(3)
}

const keys = await store.kept('sessions/')
const named = option('--song')?.split(',').map((song) => song.trim()).filter(Boolean)
const wanted = named ?? unintroduced(keys, playing)
console.log(`the Archive is ${where}; ${wanted.length} Songs that have aired need an intro, newest first${wanted.length ? `: ${wanted.slice(0, 8).join(', ')}${wanted.length > 8 ? ', …' : ''}` : ''}`)
if (args.includes('--list')) process.exit(0)
if (!wanted.length) process.exit(3)

/** How many Songs must wait for the run to go on: the Heart's number, or fewer when the Heart asks for a share of the time. */
const keepWaiting = Number(option('--waiting') ?? SONGS_AHEAD)

/** Whether a Studio is wanted: fewer Songs wait than the Heart wants, counted after the one the Radio has reached. */
async function yields() {
  const [index, now] = await Promise.all([read<{ songs: string[] }>(new URL(paths.index, where.endsWith('/') ? where : `${where}/`)), read<typeof tactus>(new URL('tactus', RADIO_URL))])
  if (!index || !now) return false
  const reached = now.next?.song ?? now.playing?.song
  const waiting = reached === undefined ? index.songs.length : index.songs.filter((song) => BigInt(song) > BigInt(reached)).length
  return waiting < keepWaiting
}

const mind = new Sleeper()
const run: Introducing = {
  store,
  dj: rezzy,
  mind,
  band: { wake: wakeBand, rest: restBand },
  async speak(facts, speaker) {
    const text = await writeSpeech(speaker, facts)
    return text ? { text, syllables: await syllableCount(text) } : undefined
  },
  grow: growIntro,
  loudness: (file) => loudnessOf(file),
  yields: args.includes('--song') ? async () => false : yields,
  log: (line) => console.log(line),
}

const started = Date.now()
try {
  const done = await introduce(run, wanted, most)
  console.log(`${done.made.length} intros made${done.made.length ? ` (${done.made.join(', ')})` : ''}, ${done.failed.length} left for another time${done.yielded ? ', and a Studio is wanted' : ''}, in ${Math.round((Date.now() - started) / 1000)}s`)
  process.exit(done.made.length || done.yielded ? 0 : done.failed.length ? 1 : 3)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
