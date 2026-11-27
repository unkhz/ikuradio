// The Studio: a short life, spent making one Song.
//
// It wakes, takes back from the Archive whatever its machine has forgotten,
// reads its diary to see where the song is, and makes the next
// Song whole: first every word of every iteration, while the mind is awake,
// and the one thought the mind writes down about them; then the mind rests, and every line is sung; then the Music has the GPU,
// and every bed is grown. When the Song is made, its Recordings and its
// Session are left in the Archive, where the Radio will find it and
// Receivers will fetch it, and the Studio lets go of everything else, and
// ends.
//
//   bun run studio

import { getEnv, pieces, Sleeper } from 'tools'
import { attentions, keepThought, namelessOf, nameSong, readMemories, readThoughts, recall, words, writeThought } from 'song'
import { wrongness } from 'melody'
import { describe } from 'mood'
import { introduce, loudnessOf, recordingName, throatName, vocalsDir, type Loudness } from 'vocals'
import { isBare } from './lib/bare.js'
import { growBeds, musicDir, restBand, sections, Shelf, wakeBand, type BedAsked } from 'music'
import { partsById, readTracks } from 'parts'
import { openArchive } from 'archive'
import { describePerspectives, perspectivesFor } from 'perspectives'
import { Diary } from './lib/diary.js'
import { composer, placeOf, type Iteration } from './lib/compose.js'
import { perform, type SungLine } from './lib/perform.js'
import { chooser, takeOf } from './lib/arrangement.js'
import { songAsItAlwaysWas } from './lib/compose.js'
import { describeQueued, SongQueue } from './lib/queue.js'
import { type Made } from './lib/session.js'
import { sessionOf } from './lib/timeline.js'
import { humGuides, type Guide } from './lib/guide.js'
import { againstSections, askedOf, kindOf, laid, measure, partsOf, sourceOf } from './lib/asking.js'
import { renderSynths } from './lib/synth.js'
import { sweep } from './lib/sweep.js'
import { homecoming } from './lib/homecoming.js'
import { holdStudio, StudioBusy } from './lib/lock.js'

// one Studio to a machine: before anything is read, swept or written, the
// machine's lock is held, or this Studio stops at once. It is held until the
// Studio ends, and let go by the kernel however it ends.
try {
  holdStudio()
} catch (error) {
  if (!(error instanceof StudioBusy)) throw error
  console.error(error.message)
  process.exit(1)
}

const {
  ARRANGEMENT,
  MOOD_COUNT,
  CHOIR_COUNT,
  SYLLABLES_PER_SECOND,
  VARIATION_COUNT,
  MIND_CONTEXT,
  PORO_MODEL,
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
// on a machine that has lost the song, its memory is first taken back from
// the Archive; on one that remembers less than the Archive holds, the Studio
// does not wake at all
const home = await homecoming(store, { diary, thoughts: thoughtsDir })
if (home.books || home.months) {
  console.log(
    `this machine had forgotten; the Archive gave back ${home.books} books of the diary and ${home.months} months of the mind's thoughts`,
  )
}
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

// the Arrangement the Song is made as, before the mind is woken: pinned by `ARRANGEMENT`, popped from the manual production queue when beginning a new Song,
// or drawn by weight across active makeable Arrangements — each read, checked and found makeable, or refused here, plainly
const pick = await chooser(ARRANGEMENT)
const middle = await diary.lastPage().then((page) => page?.song)
const inMiddle = Boolean(middle && wakesAt - BigInt(middle.began) < BigInt(middle.lasts))
if (inMiddle && middle?.arrangement !== undefined) await pick.byId(middle.arrangement)
const queue = new SongQueue('memory/queue.jsonl')
const queued = !inMiddle && ARRANGEMENT === undefined ? await queue.nextReady({ checkArrangement: (id) => pick.byId(id) }) : undefined
const queuedTake = queued?.arrangement ? takeOf(await pick.byId(queued.arrangement)) : undefined
if (queued) {
  const attempt = await queue.markAttempt(queued.id)
  console.log(`picking up queued Song ${queued.id} (attempt ${attempt}): ${describeQueued(queued)}`)
}
console.log(`a Song that begins is made as ${queuedTake ? `queued "${queuedTake.id}" (${queuedTake.iterations} iteration${queuedTake.iterations > 1 ? 's' : ''})` : pick.summary}`)

// peek the Song's Perspectives before waking the mind so Finnish Songs wake Poro instead of the English model
const lastBeforeWake = await diary.lastPage()
const nextPlace = placeOf(wakesAt, lastBeforeWake, queuedTake ? () => queuedTake : pick.take)
const peekedLang: 'en' | 'fi' = !lastBeforeWake
  ? 'en'
  : nextPlace.beginsSong
    ? (
        await perspectivesFor(`${nextPlace.number}`, {
          choirSize: CHOIR_COUNT,
          ...(queued?.perspectives !== undefined ? { only: queued.perspectives } : {}),
        })
      ).settings.language.code
    : (lastBeforeWake.settings?.language?.code ?? 'en')

// the words, all of them, while the mind is awake
const mind = new Sleeper()
await mind.wake(peekedLang === 'fi' ? PORO_MODEL : undefined)
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
  take: queuedTake ? () => queuedTake : pick.take,
  arrangementOf: (id) => pick.byId(id).then(({ arrangement }) => arrangement),
  moodCount: MOOD_COUNT,
  choirSize: CHOIR_COUNT,
  variationCount: VARIATION_COUNT,
  rate: SYLLABLES_PER_SECOND,
  memories,
  ...(queued ? { queued } : {}),
})
const composed: Iteration[] = []
for (let iteration = wakesAt; ; iteration++) {
  const one = await compose(iteration)
  composed.push(one)
  if (endsSong(one)) break
}
// and, before it rests, the mind writes down what it thought of them
const songLang = composed[0]?.settings?.language?.code ?? 'en'
const thought = await writeThought(
  composed.map(({ lyrics }) => words(lyrics).map(({ content }) => content).join('\n\n')).join('\n\n'),
  composed[0].mood.descriptions,
  own.slice(-heldAgainst),
  // each Song, the mind's attention is turned somewhere a little different
  {
    attention: attentions[Math.floor(wrongness(`attention:${composed[0].song.number}`)() * attentions.length)],
    lang: songLang,
  },
).catch((error: Error) => {
  console.warn(`the mind kept no thought: ${error.message}`)
  return undefined
})
console.log(thought ? `the mind thinks: ${thought}` : 'the mind is silent about this Song')
// and, before it rests, the mind names the Song: what it is for, in a few
// words, from what it says and the weather it says it in
const taken = await store.names().catch((error: Error) => {
  console.warn(`the Archive's names could not be read: ${error.message}`)
  return {}
})
const named =
  (await nameSong(
    composed.map(({ lyrics }) => words(lyrics).map(({ content }) => content).join('\n\n')).join('\n\n'),
    composed[0].mood.descriptions,
    taken,
    { lang: songLang },
  ).catch((error: Error) => {
    console.warn(`the mind gave the Song no name: ${error.message}`)
    return undefined
  })) ??
  // a Song no mind names is named by its own number: the namelessness is
  // its lore, its slug is its own alone, and its link is made like any
  // other's, for the Archive holds no Song without an address
  namelessOf(`${composed[0].song.number}`, taken)
console.log(`the Song is named: ${named}`)
await mind.rest()
const [first] = composed
console.log(
  `Song ${first.song.number} "${named}": ${describe(first.mood)}, sung by ${introduce(first.choir)}` +
    `, heard ${describePerspectives(first.perspectives)}` +
    `; ${composed.length} iterations written in ${seconds(started)}`,
)

// what the Arrangement's timeline asks to be made: the regions of each iteration, and every voice, guide, bed, drone and pulse key under them
const chosenArrangement = await pick.byId(first.song.arrangement ?? songAsItAlwaysWas)
const songArrangement = chosenArrangement.arrangement
const [tracks, partMap] = await Promise.all([readTracks(), partsById()])
const asking = askedOf(songArrangement, tracks, undefined, first.mood.character.tempo, partMap)
const passOf = (one: Iteration) => Number(one.iteration - BigInt(one.song.began))

// the voices
const sungAt = Date.now()
const sung: SungLine[][] = []
for (const one of composed) sung.push(await perform(one, sung.at(-1) ?? [], partsOf(asking.passes[passOf(one)]!.regions, one.lyrics, partMap)))
console.log(`sung in ${seconds(sungAt)}`)

// the regions last what they were sung for; the timeline is read again over those lengths, and the guides and beds are asked from it
const measured = songArrangement.instances.map(() => 0)
for (const [i, one] of composed.entries()) {
  const { regions } = asking.passes[passOf(one)]!
  for (const [n, lasts] of measure(regions, one.lyrics, sung[i]).seconds.entries()) measured[regions[n]!.global] = lasts
}
const asked = askedOf(songArrangement, tracks, measured, first.mood.character.tempo, partMap)

// the guide hums, for the Music alone: what the lead's melody was written over, in two voices; one for each guide key
const guides: Guide[][] = []
for (const [i, one] of composed.entries()) {
  const here = asked.passes[passOf(one)]!
  const heard = sections(sung[i])
  // a guide is hummed for a section by its place: a Song with sections that are not its regions would be made wrongly, and cannot be taken back
  if (heard.length !== here.regions.length) throw new Error(`the iteration was sung in ${heard.length} sections and its timeline has ${here.regions.length} regions: the Song is not made`)
  guides.push(await humGuides(one, sung[i], guides[i - 1], here.guides.map((making) => ({ key: making.key, section: sourceOf(here, making).index, bpm: making.placings[0]?.bpm }))))
}

// the Music, with the GPU to itself: the band is woken once for all the Song's beds
const grownAt = Date.now()
await wakeBand().then(
  () => console.log(`the band is awake in ${seconds(grownAt)}`),
  (error: Error) => console.warn(`the band would not stay awake, and wakes for each bed: ${error.message}`),
)
const shelf = new Shelf()
const made: Made[] = []
for (const [i, one] of composed.entries()) {
  const lines = sung[i]
  const hummed = guides[i]
  const here = asked.passes[passOf(one)]!
  const heard = sections(lines)
  const files = new Map(hummed.map(({ key, file }) => [key, file]))
  // each bed key is grown once, from the guide of the region it is made from
  const wanted: BedAsked[] = here.beds.map((making) => {
    const region = sourceOf(here, making)
    const guide = here.guides.find((one) => sourceOf(here, one).index === region.index)
    const guided = guide ? files.get(guide.key) : undefined
    return {
      key: making.key,
      kind: kindOf(here.regions, region.index),
      part: region.part,
      seconds: making.seconds,
      tempo: making.placings[0]?.bpm,
      ...(guided ? { guide: guided } : {}),
      ...(heard[region.index] ? { section: heard[region.index] } : {}),
    }
  })
  const grew = await growBeds(wanted, one.mood, { shelf, iteration: one.iteration, bridgeBeds: one.settings['bridge-beds'] }).catch((error) => {
    console.warn(`the Music did not come for iteration ${one.iteration}: ${error.message}`)
    return undefined
  })
  const beds = new Map(grew?.beds)
  const lay = laid(asked, passOf(one), hummed, beds)
  console.log(`iteration ${one.iteration}: ${wanted.length} beds asked, ${grew?.grown ?? 0} grown, ${beds.size - (grew?.grown ?? 0)} taken from the Shelf, ${lay.beds.length} placed under ${here.regions.length} regions`)
  const unsaid = againstSections(lay, heard)
  if (unsaid.length) {
    console.warn(`asking: the timeline's placings differ from the sections as they were sung in ${unsaid.length} place${unsaid.length > 1 ? 's' : ''}:`)
    for (const line of unsaid.slice(0, 20)) console.warn(`asking:   ${line}`)
  }
  made.push({ composed: one, lines, beds: lay.beds, guides: lay.guides })
}
// render procedural tracks (`drone`, `pulse`) after all passes' guides exist so a whole-Song drone follows chords across every iteration
const allLaidGuides = made.flatMap(({ guides: passGuides = [] }, idx) => {
  const passOffset = asked.resolved.regions[asked.passes[idx]!.regions[0]!.global]!.startSeconds
  return passGuides.map((g) => ({ ...g, at: passOffset + g.at }))
})
for (const [idx, entry] of made.entries()) {
  const passOffset = asked.resolved.regions[asked.passes[idx]!.regions[0]!.global]!.startSeconds
  const shiftedGuides = allLaidGuides.map((g) => ({ ...g, at: g.at - passOffset }))
  const rendered = await renderSynths(asked, idx, entry.composed.mood, shiftedGuides, entry.composed.song.number)
  if (rendered.length) entry.synths = rendered
}
await restBand()
console.log(`accompanied in ${seconds(grownAt)}`)
// a Song without any band or procedural accompaniment is not kept: the Archive is for ever (issue 4)
if (isBare(made)) {
  console.error('no bed came for any iteration; the Song is not kept, and the Studio stops so the Heart may call another')
  process.exit(1)
}

// into the Archive: the Music's Recordings first, then the Session that names
// them. The voices, spoken lines, guides, and procedural synths are kept as
// their source in the Session, for every Receiver to render; their recordings
// stay here, and are let go with the rest of the Studio's copies
const beds = new Set(made.flatMap(({ beds }) => beds.map(({ file }) => file)))
const voices = new Set(
  made.flatMap(({ lines }) =>
    lines.filter(({ unheard }) => !unheard).flatMap((line) => (line.speech && line.file ? [line.file] : line.voices.map(({ file }) => file))),
  ),
)
const synths = new Set(made.flatMap(({ synths = [] }) => synths.map(({ file }) => file)))
const guiding = new Set(made.flatMap(({ guides = [] }) => guides.map(({ file }) => file)))
// how loud each voice, spoken line, synth, and bed sounds, heard from its recording, now that it is made
const heardAt = Date.now()
const loudness = new Map<string, Loudness>()
const files = new Set([...voices, ...beds, ...synths])
await Promise.all(
  [...files].map(async (file) => {
    const measured = await loudnessOf(file)
    if (measured) loudness.set(file, measured)
  }),
)
console.log(`${loudness.size} of ${files.size} recordings measured in ${seconds(heardAt)}`)
const ids = new Map<string, string>()
for (const file of [...voices, ...guiding, ...synths]) ids.set(file, recordingName(file))
for (const file of beds) ids.set(file, await store.putRecording(file))
// the Session is written from the Arrangement's timeline, over what was made: the Archive is for ever, and what is published is what the timeline says
const session = sessionOf({
  arrangement: songArrangement,
  arrangementTitle: chosenArrangement.title,
  parts: partMap,
  tracks,
  made,
  name: (file) => ids.get(file)!,
  loudness: (file) => loudness.get(file),
  throat: throatName(),
  thought,
  songName: named,
})
await store.putSession(session)
if (queued) {
  await queue.consume(queued.id)
  console.log(`consumed queued Song ${queued.id} (published as Song ${session.song})`)
}
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
  `Song ${session.song}${session.name ? ` "${session.name}"` : ''} is in the Archive: ${(session.seconds / 60).toFixed(1)} minutes,` +
    ` ${beds.size} beds and ${voices.size} takes, made in ${seconds(started)}`,
)

// the Studio's own copies are not needed any more
await sweep([vocalsDir, musicDir], Date.now() + 1000)
