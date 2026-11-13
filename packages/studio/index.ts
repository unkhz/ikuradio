// The Studio: a short life, spent making one Song.
//
// It wakes, reads its diary to see where the song is, and makes the next
// Song whole: first every word of every iteration, while the mind is awake,
// and the one thought the mind writes down about them; then the mind rests, and every line is sung; then the Music has the GPU,
// and every bed is grown. When the Song is made, its Recordings and its
// Session are left in the Archive, where the Radio will find it and
// Receivers will fetch it, and the Studio lets go of everything else, and
// ends.
//
//   bun run studio

import { getEnv, pieces, Sleeper } from 'tools'
import { keepThought, readMemories, readThoughts, recall, words, writeThought } from 'song'
import { wrongness } from 'melody'
import { describe } from 'mood'
import { introduce, loudnessOf, recordingName, throatName, vocalsDir, type Loudness } from 'vocals'
import { musicDir, Shelf, underlay } from 'music'
import { openArchive } from 'archive'
import { describePerspectives } from 'perspectives'
import { Diary } from './lib/diary.js'
import { composer, type Iteration } from './lib/compose.js'
import { perform } from './lib/perform.js'
import { toSession, type Made } from './lib/session.js'
import { humGuides } from './lib/guide.js'
import { sweep } from './lib/sweep.js'

const {
  ITERATION_COUNT,
  PERSPECTIVE_COUNT,
  MOOD_COUNT,
  CHOIR_COUNT,
  VARIATION_COUNT,
  MIND_CONTEXT,
} = getEnv()

/**
 * How much of the mind's memory, in pieces, its memories may fill: what is
 * left beside the instruction, the verse it is given, and the verse it
 * writes.
 */
const roomForMemories = Math.max(0, MIND_CONTEXT - 1100)

/** Where the mind keeps its own thoughts, beside the diary: a file a month. */
const thoughtsDir = 'memory/thoughts'

/** While it has kept fewer thoughts than this, the mind always hears the robot: a mind with no past is not left alone with it. */
const newborn = 12

/** How often the mind hears the robot, once it has a past of its own. */
const telepathy = 0.5

/** How many of its newest thoughts a new one is held against, so it does not think one of them again. */
const heldAgainst = 200

const { store, where } = openArchive()
console.log(`the Studio publishes to ${where}`)
const started = Date.now()
const seconds = (since: number) => `${((Date.now() - since) / 1000).toFixed(1)}s`

// whatever an earlier Studio left behind, unfinished, is let go
await sweep([vocalsDir, musicDir])

const diary = new Diary('memory/diary.jsonl')
// a Song written down but never published, by a Studio that fell before the
// end, is not remembered: its pages are taken back, and it is made again
const lastWritten = await diary.lastPage()
if (lastWritten?.song && !(await store.hasSession(lastWritten.song.number))) {
  const taken = await diary.unwrite(lastWritten.song.number)
  console.warn(
    `Song ${lastWritten.song.number} was written but never published; ${taken} pages are taken back, and it is made again`,
  )
}
// the song counts from one: its first iteration is iteration 1
const wakesAt = await diary.lastPage().then((page) => (page ? BigInt(page.iteration) + 1n : 1n))

/** Whether an iteration is the last of its Song. */
const endsSong = ({ iteration, song }: Iteration) =>
  iteration - BigInt(song.began) + 1n >= BigInt(song.lasts)

// the words, all of them, while the mind is awake
const mind = new Sleeper()
await mind.wake()
// what the mind remembers at this sitting, as much as fits: its own thoughts,
// and, now and then, the robot's, heard as if by telepathy
const own = (await readThoughts(thoughtsDir)).map(({ thought }) => thought)
const hears = own.length < newborn || wrongness(`telepathy:${wakesAt}`)() < telepathy
const memories = await recall({
  own,
  heard: await readMemories(),
  hears,
  room: roomForMemories,
  random: wrongness(`memories:${wakesAt}`),
  measure: (text) => pieces(text).catch(() => Math.ceil(text.length / 4)),
})
console.log(
  `the mind sits down with ${memories.own.length} thoughts of its own` +
    (memories.heard.length ? `, and hears ${memories.heard.length} of the robot's` : ''),
)
const { compose } = await composer(diary, {
  songLength: ITERATION_COUNT,
  perspectiveCount: PERSPECTIVE_COUNT,
  moodCount: MOOD_COUNT,
  choirSize: CHOIR_COUNT,
  variationCount: VARIATION_COUNT,
  memories,
})
const composed: Iteration[] = []
for (let iteration = wakesAt; ; iteration++) {
  const one = await compose(iteration)
  composed.push(one)
  if (endsSong(one)) break
}
// and, before it rests, the mind writes down what it thought of them
const thought = await writeThought(
  composed.map(({ lyrics }) => words(lyrics).map(({ content }) => content).join('\n\n')).join('\n\n'),
  composed[0].mood.descriptions,
  own.slice(-heldAgainst),
).catch((error: Error) => {
  console.warn(`the mind kept no thought: ${error.message}`)
  return undefined
})
console.log(thought ? `the mind thinks: ${thought}` : 'the mind is silent about this Song')
await mind.rest()
const [first] = composed
console.log(
  `Song ${first.song.number}: ${describe(first.mood)}, sung by ${introduce(first.choir)}` +
    `, heard ${describePerspectives(first.perspectives)}` +
    `; ${composed.length} iterations written in ${seconds(started)}`,
)

// the voices
const sungAt = Date.now()
const sung = []
for (const one of composed) sung.push(await perform(one))
console.log(`sung in ${seconds(sungAt)}`)

// the guide hums: the lead's melody with fewer notes, for the Music alone
const guides = []
for (const [i, one] of composed.entries()) guides.push(await humGuides(one, sung[i]))

// the Music, with the GPU to itself
const grownAt = Date.now()
const shelf = new Shelf()
const made: Made[] = []
for (const [i, one] of composed.entries()) {
  const lines = sung[i]
  const hummed = guides[i]
  const beds = await underlay(lines, one.mood, {
    shelf,
    iteration: one.iteration,
    guides: new Map(hummed.map(({ kind, file }) => [kind, file])),
    bridgeBeds: one.settings['bridge-beds'],
  })
    .then(({ beds }) => beds)
    .catch((error) => {
      console.warn(`the Music did not come for iteration ${one.iteration}: ${error.message}`)
      return []
    })
  made.push({ composed: one, lines, beds, guides: hummed })
}
console.log(`accompanied in ${seconds(grownAt)}`)

// into the Archive: the Music's Recordings first, then the Session that names
// them. The voices and the guides are kept as their source, the takes in the
// Session, for every Receiver to sing; their recordings stay here, and are
// let go with the rest of the Studio's copies
const beds = new Set(made.flatMap(({ beds }) => beds.map(({ file }) => file)))
const voices = new Set(
  made.flatMap(({ lines }) =>
    lines.filter(({ unheard }) => !unheard).flatMap(({ voices }) => voices.map(({ file }) => file)),
  ),
)
const guiding = new Set(made.flatMap(({ guides = [] }) => guides.map(({ file }) => file)))
// how loud each voice and bed sounds, heard from its recording, now that it is made
const heardAt = Date.now()
const loudness = new Map<string, Loudness>()
const files = new Set([...voices, ...beds])
await Promise.all(
  [...files].map(async (file) => {
    const measured = await loudnessOf(file)
    if (measured) loudness.set(file, measured)
  }),
)
console.log(`${loudness.size} of ${files.size} recordings measured in ${seconds(heardAt)}`)
const ids = new Map<string, string>()
for (const file of [...voices, ...guiding]) ids.set(file, recordingName(file))
for (const file of beds) ids.set(file, await store.putRecording(file))
const session = toSession(
  made,
  (file) => ids.get(file)!,
  (file) => loudness.get(file),
  throatName(),
  thought,
)
await store.putSession(session)
// the thought is kept only once its Song is published: a Song made again is thought about again
if (thought) {
  const month = await keepThought(thoughtsDir, { song: session.song, written: new Date().toISOString(), thought })
  await store.putThoughts(month).catch((error: Error) => {
    console.warn(`the mind's thoughts were not copied to the Archive: ${error.message}`)
  })
}
// and the diary, so the song's memory is not on this machine only
const shelved = await store
  .putDiary({ writing: diary.file, books: (await diary.books()).map(({ file }) => file) })
  .catch((error: Error) => {
    console.warn(`the diary was not copied to the Archive: ${error.message}`)
    return undefined
  })
if (shelved !== undefined) {
  console.log(`the diary is in the Archive${shelved ? `, with ${shelved} more books on its shelf` : ''}`)
}
console.log(
  `Song ${session.song} is in the Archive: ${(session.seconds / 60).toFixed(1)} minutes,` +
    ` ${beds.size} beds and ${voices.size} takes, made in ${seconds(started)}`,
)

// the Studio's own copies are not needed any more
await sweep([vocalsDir, musicDir], Date.now() + 1000)
