// The Studio: a short life, spent making one Song.
//
// It wakes, reads its diary to see where the song is, and makes the next
// Song whole: first every word of every iteration, while the mind is awake;
// then the mind rests, and every line is sung; then the Music has the GPU,
// and every bed is grown. When the Song is made, its Recordings and its
// Session are left in the Archive, where the Radio will find it and
// Receivers will fetch it, and the Studio lets go of everything else, and
// ends.
//
//   bun run studio

import { getEnv, Sleeper } from 'tools'
import { describe } from 'mood'
import { introduce, loudnessOf, vocalsDir, type Loudness } from 'vocals'
import { musicDir, Shelf, underlay } from 'music'
import { Store } from 'archive'
import { Diary } from './lib/diary.js'
import { composer, type Iteration } from './lib/compose.js'
import { perform } from './lib/perform.js'
import { toSession, type Made } from './lib/session.js'
import { sweep } from './lib/sweep.js'

const {
  ITERATION_COUNT,
  MOOD_COUNT,
  CHOIR_COUNT,
  VARIATION_COUNT,
  ARCHIVE_DIR,
} = getEnv()

const store = new Store(ARCHIVE_DIR)
const started = Date.now()
const seconds = (since: number) => `${((Date.now() - since) / 1000).toFixed(1)}s`

// whatever an earlier Studio left behind, unfinished, is let go
await sweep([vocalsDir, musicDir])

const diary = new Diary('memory/diary.jsonl')
const { wakesAt, compose } = await composer(diary, {
  songLength: ITERATION_COUNT,
  moodCount: MOOD_COUNT,
  choirSize: CHOIR_COUNT,
  variationCount: VARIATION_COUNT,
})

/** Whether an iteration is the last of its Song. */
const endsSong = ({ iteration, song }: Iteration) =>
  iteration - BigInt(song.began) + 1n >= BigInt(song.lasts)

// the words, all of them, while the mind is awake
const mind = new Sleeper()
await mind.wake()
const composed: Iteration[] = []
for (let iteration = wakesAt; ; iteration++) {
  const one = await compose(iteration)
  composed.push(one)
  if (endsSong(one)) break
}
await mind.rest()
const [first] = composed
console.log(
  `Song ${BigInt(first.song.number) + 1n}: ${describe(first.mood)}, sung by ${introduce(first.choir)}` +
    `; ${composed.length} iterations written in ${seconds(started)}`,
)

// the voices
const sungAt = Date.now()
const sung = []
for (const one of composed) sung.push(await perform(one))
console.log(`sung in ${seconds(sungAt)}`)

// the Music, with the GPU to itself
const grownAt = Date.now()
const shelf = new Shelf()
const made: Made[] = []
for (const [i, one] of composed.entries()) {
  const lines = sung[i]
  const beds = await underlay(lines, one.mood, { shelf, iteration: one.iteration })
    .then(({ beds }) => beds)
    .catch((error) => {
      console.warn(`the Music did not come for iteration ${one.iteration}: ${error.message}`)
      return []
    })
  made.push({ composed: one, lines, beds })
}
console.log(`accompanied in ${seconds(grownAt)}`)

// into the Archive: the Recordings first, then the Session that names them
const files = new Set(
  made.flatMap(({ lines, beds }) => [
    ...lines.filter(({ unheard }) => !unheard).flatMap(({ voices }) => voices.map(({ file }) => file)),
    ...beds.map(({ file }) => file),
  ]),
)
// how loud each Recording sounds, heard from the Recording itself, now that it is made
const heardAt = Date.now()
const loudness = new Map<string, Loudness>()
await Promise.all(
  [...files].map(async (file) => {
    const measured = await loudnessOf(file)
    if (measured) loudness.set(file, measured)
  }),
)
console.log(`${loudness.size} of ${files.size} recordings measured in ${seconds(heardAt)}`)
const ids = new Map<string, string>()
for (const file of files) ids.set(file, await store.putRecording(file))
const session = toSession(
  made,
  (file) => ids.get(file)!,
  (file) => loudness.get(file),
)
await store.putSession(session)
const pruned = await store.prune()
console.log(
  `Song ${BigInt(session.song) + 1n} is in the Archive: ${(session.seconds / 60).toFixed(1)} minutes,` +
    ` ${files.size} recordings${pruned ? `, ${pruned} let go` : ''}, made in ${seconds(started)}`,
)

// the Studio's own copies are not needed any more
await sweep([vocalsDir, musicDir], Date.now() + 1000)
