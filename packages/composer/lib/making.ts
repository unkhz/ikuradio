// What a Song makes, as the pages of the Tune, the Lyrics, the Score, the Beds and the Song say it (plan "Evolution of
// Song", step 7): illustrated from the first tune and sample words, each read from the package that owns it. The words
// are a sample, and their syllables are counted by a rough rule (a vowel, and the letters round it), since the throat
// that counts them as a person would does not run here.

import { bridgeBeats, chorusHook, composeGuide, evolve, firstTune, fitToCount, growOnReciting, modes, roaming, spacing, timedLine, variations, wrongness, type Phrase, type Tune } from 'melody'
import { arrange, chorusOpening, firstLyrics, stresses, type Lyrics } from 'song'
import { readArrangements, readTracks, type Part, type PartRecord } from 'parts'
import { layoutOf } from './layout.js'
import { timelineOf } from './timeline.js'

type Syllables = { stresses: number[]; comma?: boolean }
/** A word of a line: its syllables' stress, and whether the dictionary knew it (else they were counted by a rough rule). */
export type Word = { text: string; stresses: number[]; comma: boolean; rough: boolean }

/** The pieces of a word, a vowel and the letters round it: a rough count of its syllables, for a word the dictionary does not know. */
export function piecesOf(word: string): string[] {
  const letters = word.replace(/[^a-z']/gi, '')
  const pieces = letters.match(/[^aeiouy']*[aeiouy]+(?:'?s$|[^aeiouy]+$)?/gi)
  // a silent final e does not make a syllable of its own
  if (pieces && pieces.length > 1 && /^[^aeiouy]*e$/i.test(pieces.at(-1)!)) pieces.pop()
  return pieces?.length ? pieces : [letters]
}

/** The rough stress of a word: its first syllable is main when it has more than one; a short word is light, a long one main. */
const roughStresses = (text: string): number[] => {
  const count = piecesOf(text).length
  return Array.from({ length: count }, (_, i) => (count === 1 ? (text.length > 3 ? 1 : 0) : i === 0 ? 1 : 0))
}

/**
 * Words as the bar fit sees them, with their syllables counted from the pronouncing dictionary the song already uses
 * (the throat's, read by `stresses` in the song package), and by a rough rule only for a word it does not know, or when
 * the throat has not been built here: those are marked `rough`.
 */
export async function wordsOf(line: string): Promise<Word[]> {
  // hyphens let words apart, as the throat sings them
  const raws = line.replace(/[-–—]+/g, ' ').split(/\s+/).filter(Boolean)
  return Promise.all(
    raws.map(async (raw) => {
      const text = raw.replace(/[,.;:!?]+$/, '')
      const [heard] = await stresses(text).catch(() => [])
      return { text, stresses: heard?.stresses ?? roughStresses(text), comma: /[,;:.!?]$/.test(raw), rough: !heard?.stresses }
    }),
  )
}

const forFit = (words: readonly Word[]): Syllables[] => words.map(({ stresses, comma }) => ({ stresses, ...(comma ? { comma } : {}) }))

/** How many syllables a line has. */
export const syllablesOf = (words: readonly Word[]) => words.reduce((sum, word) => sum + word.stresses.length, 0)

/** How long a phrase is, its rest included, in beats. */
export const lengthOf = (phrase: Phrase) => phrase.notes.reduce((sum, [, beats]) => sum + beats, 0) + phrase.rest

/** A phrase as a page draws it. */
export type Drawn = { notes: [number, number][]; rest: number; reciting?: number }
const drawn = (phrase: Phrase, reciting?: number): Drawn => ({ notes: phrase.notes.map(([degree, beats]): [number, number] => [degree, beats]), rest: phrase.rest, ...(reciting !== undefined ? { reciting } : {}) })

// ---- the Tune

/** How many Songs the tune is evolved for, to show its phrases moving step by step. */
const evolved = 6

/** What changed between two phrases: one flag to each note. */
const changed = (a: Phrase, b: Phrase) => a.notes.map(([degree, beats], i) => degree !== b.notes[i]?.[0] || beats !== b.notes[i]?.[1])

/**
 * The tune, by its own names: each of its keys (`Object.keys(firstTune)`) with its phrases as drawn, the reciting note ringed;
 * which of them evolve from Song to Song and which stay; the evolving ones a step at a time; and a Song's Variations.
 */
export function tuneAnswer({ songs = evolved }: { songs?: number } = {}) {
  const names = Object.keys(firstTune) as (keyof Tune)[]
  const steps: Tune[] = [firstTune]
  for (let i = 1; i <= songs; i++) steps.push(evolve(steps[i - 1]!, `composer:${i}`))
  const made = variations(firstTune, 4, 'composer', { ornaments: 1, steps: 1 })
  const moves = (tunes: readonly Tune[], key: keyof Tune) => tunes.some((tune) => JSON.stringify(tune[key]) !== JSON.stringify(firstTune[key]))
  // the reciting note is the melody's, kept by the hook the tune was born with
  const hooks: Partial<Record<keyof Tune, readonly Phrase[]>> = { chorus: chorusHook }
  const recitingOf = (key: keyof Tune, i: number) => (hooks[key]?.[i] as { reciting?: number } | undefined)?.reciting
  const phrasesOf = (tune: Tune, key: keyof Tune, from?: Tune) =>
    tune[key].map((phrase, i) => ({ ...drawn(phrase, recitingOf(key, i)), changed: from ? changed(from[key][i]!, phrase) : phrase.notes.map(() => false) }))
  return {
    names,
    born: Object.fromEntries(names.map((key) => [key, phrasesOf(firstTune, key)])),
    evolves: names.filter((key) => moves(steps, key)),
    stays: names.filter((key) => !moves(steps, key)),
    evolution: steps.map((tune, step) => ({ step, tunes: Object.fromEntries(names.map((key) => [key, phrasesOf(tune, key, step ? steps[step - 1] : undefined)])) })),
    variations: made.map((tune, variation) => ({ variation, tunes: Object.fromEntries(names.map((key) => [key, phrasesOf(tune, key, firstTune)])) })),
    varies: names.filter((key) => moves(made, key)),
  }
}

// ---- the Lyrics

/** The Arrangement the pages of what a Song makes are drawn from: the Song as it always was, which `arrange()` in the song package lays out. */
export const songsArrangement = 'the-song'

/** That Arrangement, if it is there and active. */
async function theSong(records: readonly PartRecord[], arrangementsDir: string, id: string = songsArrangement) {
  return (await readArrangements(records, arrangementsDir)).find(({ arrangement, state }) => arrangement.id === id && state === 'active')
}

/**
 * The Lyrics field each instance sings. A name's words are the field `arrange()` places at the name's first hearing, and every
 * hearing of the name sings it: after a turn too, where the name goes on with its own words. An instance that continues another
 * name sings the field that one does.
 */
export function fieldsOf(instances: readonly { name: string; continues?: string }[]): (keyof Lyrics | undefined)[] {
  const named = Object.fromEntries((Object.keys(firstLyrics) as (keyof Lyrics)[]).map((field) => [field, field])) as Lyrics
  const sung = arrange(named)
  const byName = new Map(instances.map((instance) => [instance.name, instance]))
  const rootOf = (name: string, seen = new Set<string>()): string => {
    const next = byName.get(name)?.continues
    return next !== undefined && !seen.has(name) ? rootOf(next, seen.add(name)) : name
  }
  const fieldOfName = (name: string): keyof Lyrics | undefined => {
    const first = instances.findIndex((instance) => instance.name === name)
    return sung[first]?.content ? (sung[first]!.content as keyof Lyrics) : undefined
  }
  return instances.map(({ name }) => fieldOfName(rootOf(name)))
}

const sampleWordiness = [0.2, 0.5, 0.9]
const written = (part: Part) => part.words === 'written'

/** The part whose first line is not the mind's to write but the Song's age (found by asking each part for its fixed line), if one is. */
export function ageIn(records: readonly PartRecord[]): string | undefined {
  return records.find(({ part }) => part.fixedLine?.(0, { iteration: 1n, last: false }) !== undefined)?.part.id
}

/** The five fields of Lyrics, the instances of the Arrangement each fills, each line's count at a tempo, and the Song's age growing. */
export async function lyricsAnswer(records: readonly PartRecord[], arrangementsDir: string, tempo: number, rate = 6) {
  const fields = Object.keys(firstLyrics) as (keyof Lyrics)[]
  const first = await theSong(records, arrangementsDir)
  const fieldOf = first ? fieldsOf(first.arrangement.instances) : []
  const fills = first ? first.arrangement.instances.map(({ name, part }, i) => ({ instance: name, part, field: fieldOf[i] })) : []
  const lines = records.filter(({ part }) => written(part)).map(({ part }) => ({
    part: part.id,
    lines: [0, 1, 2, 3].map((line) => ({
      line,
      counts: sampleWordiness.map((wordiness) => ({ wordiness, ...part.measure({ line, tune: firstTune, tempo, rate, parameters: { wordiness } }) })),
    })),
  }))
  return { fields, arrangement: first?.arrangement.id, fills, tempo, rate, lines, ageIn: ageIn(records), age: await Promise.all([1, 12, 2548].map((iteration) => ageOf(BigInt(iteration), tempo, rate))) }
}

/** The Song's age as the first line of its refrain: its words, and how many bars it grows past its phrase on the reciting note. */
export async function ageOf(iteration: bigint, tempo: number, rate: number) {
  const text = chorusOpening(iteration)
  const words = await wordsOf(text)
  const phrase = { ...firstTune.chorus[0]!, reciting: chorusHook[0]!.reciting }
  const fitted = growOnReciting(phrase, forFit(words), spacing(tempo, rate))
  return {
    iteration: Number(iteration),
    text,
    syllables: syllablesOf(words),
    rough: words.some((word) => word.rough),
    grown: fitted ? Math.round((lengthOf(fitted) - lengthOf(firstTune.chorus[0]!)) / 4) : undefined,
  }
}

// ---- the Score

/** Sample words, a line to each phrase of a verse: the words of a Song the radio sang. */
export const sampleVerse = ["In the crystal memory of a winter's night,", 'I sang of a snowflake in defiance, bright.', 'It did not melt, as others swiftly did,', 'Eternity in fragile form, my bid.']

/** How the page sets a word under its notes: pixels to a beat, to a letter, between two, and to a row. The server places the words by it, so none can be set over another. */
export const captionScale = { beat: 56, glyph: 6.8, gap: 5, row: 13 } as const

export type Caption = { text: string; at: number; row: number; rough: boolean }

/**
 * The words under the notes of a line, a word under the note its first syllable stands on and a dash (the mark a hymnal
 * uses) under each note that carries the rest of it; a caption goes on the first row where it does not touch the one before.
 */
export function captionsOf(words: readonly Word[], notes: readonly (readonly [number, number])[]): Caption[] {
  const { beat, glyph, gap } = captionScale
  const syllables = words.flatMap((word) => word.stresses.map((_, i) => ({ text: i === 0 ? word.text : '–', rough: word.rough })))
  const ends: number[] = []
  let at = 0
  const captions: Caption[] = []
  for (const [n, [, beats]] of notes.entries()) {
    const syllable = syllables[n]
    if (syllable) {
      const x = at * beat
      let row = ends.findIndex((end) => end <= x)
      if (row < 0) row = ends.length
      ends[row] = x + syllable.text.length * glyph + gap
      captions.push({ ...syllable, at, row })
    }
    at += beats
  }
  return captions
}

/** A line fitted to its phrase: its words, the notes they stand on, the words set under them, and whether it fitted, grew, or did not. */
export async function fittedLine(phrase: Phrase, line: string, tempo: number, rate: number) {
  const words = await wordsOf(line)
  const k = spacing(tempo, rate)
  const fit = fitToCount(phrase, forFit(words), k)
  return {
    words,
    syllables: syllablesOf(words),
    phrase: drawn(phrase, (phrase as { reciting?: number }).reciting),
    fitted: fit ? drawn(fit.phrase) : undefined,
    captions: fit ? captionsOf(words, fit.phrase.notes) : [],
    grown: fit?.grown ?? 0,
    fits: Boolean(fit),
  }
}

/** The grid a voice sings on, and a verse's four sample lines and the age line, as the Score sets them. */
export async function scoreAnswer(records: readonly PartRecord[], tempo: number, rate: number) {
  const k = spacing(tempo, rate)
  return {
    tempo,
    rate,
    k,
    scale: captionScale,
    ageIn: ageIn(records),
    // a syllable no sooner than k sixteenths after the one before
    lines: await Promise.all(sampleVerse.map((line, i) => fittedLine(firstTune.verse[i]!, line, tempo, rate))),
    // the first line of the refrain, as the Song's age, which grows when the words outgrow the phrase
    age: await Promise.all([1, 12, 2548].map((iteration) => ageLine(iteration, k))),
  }
}

/** The Song's age as the first line of its refrain, fitted to its phrase on the reciting note: where it is set, and how many bars it grows. */
export async function ageLine(iteration: number, k: number) {
  const opening = chorusOpening(BigInt(iteration))
  const words = await wordsOf(opening)
  const phrase = { ...firstTune.chorus[0]!, reciting: chorusHook[0]!.reciting }
  const grown = growOnReciting(phrase, forFit(words), k)
  return {
    iteration,
    text: opening,
    words,
    phrase: drawn(phrase, chorusHook[0]!.reciting),
    fitted: grown ? drawn(grown) : undefined,
    captions: grown ? captionsOf(words, grown.notes) : [],
    grownBars: grown ? Math.round((lengthOf(grown) - lengthOf(firstTune.chorus[0]!)) / 4) : undefined,
  }
}

// ---- the Beds

/** The kind of a bed for an instance: a part with words keeps its name; one with none is told the parts either side of it. */
export const kindOf = (part: Part, before?: string, after?: string) => (part.words === 'none' ? `${part.id}:${before ?? 'start'}>${after ?? 'end'}` : part.id)

/** The kinds of bed an Arrangement asks for, and the guide the first section's lines make. */
export async function bedsAnswer(records: readonly PartRecord[], arrangementsDir: string, tempo: number, partId?: string) {
  const parts = new Map(records.map(({ part }) => [part.id, part]))
  const first = await theSong(records, arrangementsDir)
  const layout = first ? layoutOf(first.arrangement, parts, firstTune, tempo) : undefined
  const kinds = layout?.instances.map((instance) => ({ instance: instance.name, part: instance.part, kind: kindOf(parts.get(instance.part)!, instance.before, instance.after), beats: instance.beats, seconds: instance.seconds })) ?? []
  // the guide of a verse: its four sample lines, as timed syllables, and the chords that change where the words lean
  // the phrases of the part asked for (the verse's, unless one is named), with the sample words set to them
  const asked = partId === undefined ? undefined : records.find(({ part }) => part.id === partId)?.part
  const phrases: readonly Phrase[] = asked ? asked.phrases(firstTune, { iteration: 1n, last: false }) : firstTune.verse
  let at = 0
  const syllables: ReturnType<typeof timedLine> = []
  for (const [i, line] of sampleVerse.entries()) {
    const phrase = phrases[i]
    if (!phrase) break
    const fitted = await fittedLine(phrase, line, tempo, 6)
    const notes = fitted.fitted?.notes ?? phrase.notes
    syllables.push(...timedLine(fitted.words.map(({ stresses, comma }) => ({ stresses, comma })), notes, at))
    at += lengthOf(phrase) + (fitted.grown ? 4 * fitted.grown : 0)
  }
  // a part with no words is hummed from the parts either side of it, and no guide is composed from words here
  const guide = syllables.length ? composeGuide({ syllables, beats: at, bpm: tempo, mode: modes.aeolian, ending: 'half', random: wrongness('composer:guide'), progression: roaming }) : undefined
  return {
    tempo,
    kinds,
    bridgeBeats,
    guide: guide ? { beats: guide.beats, chords: guide.chords, furthest: guide.furthest, lower: guide.lower, upper: guide.upper, syllables: syllables.length } : undefined,
  }
}

// ---- the Song

/** What a Song is made of once it is a Session, and where each part of it comes from: the parts in order, with their kinds, their words, their timing. */
export async function songAnswer(records: readonly PartRecord[], arrangementsDir: string, tempo: number, arrangementId: string = songsArrangement) {
  const parts = new Map(records.map(({ part }) => [part.id, part]))
  const first = await theSong(records, arrangementsDir, arrangementId)
  const fieldOf = first ? fieldsOf(first.arrangement.instances) : []
  const layout = first ? layoutOf(first.arrangement, parts, firstTune, tempo) : undefined
  // where the timeline puts each part, which is where the tempo map and free time say, and not only the tune's beats at one tempo
  const timeline = first && layout ? timelineOf(first.arrangement, layout, await readTracks(), tempo) : undefined
  const resolved = timeline && !('refusal' in timeline) ? timeline : undefined
  return {
    arrangement: first?.arrangement.id,
    tempo,
    parts: (layout?.instances ?? []).map((instance, i) => ({
      index: instance.index,
      instance: instance.name,
      part: instance.part,
      kind: kindOf(parts.get(instance.part)!, instance.before, instance.after),
      words: fieldOf[i],
      start: resolved?.regions[i]?.startSeconds ?? instance.startSeconds,
      seconds: resolved?.regions[i]?.seconds ?? instance.seconds,
      ending: instance.ending,
    })),
    seconds: resolved?.seconds ?? layout?.seconds ?? 0,
    // the sounds the Session would name: one recording to a key of the timeline, and the Track it is on
    recordings: resolved ? recordingsOf(resolved) : [],
    // the fields of a Session, said once here so that a page can show them; a test holds them against the Archive's own type
    session: sessionFields,
  }
}

/** The recordings a Session would name for an Arrangement: one to a key of its timeline, on its Track, made once and placed as many times as the Blocks of that key are. */
function recordingsOf(timeline: Exclude<ReturnType<typeof timelineOf>, { refusal: string }>) {
  const found = new Map<string, { track: string; key: string; from: number; seconds: number; placed: number }>()
  for (const block of timeline.blocks) {
    const had = found.get(`${block.track}\u0000${block.key}`)
    if (had) had.placed++
    else found.set(`${block.track}\u0000${block.key}`, { track: block.track, key: block.key, from: block.startSeconds, seconds: block.seconds, placed: 1 })
  }
  return [...found.values()]
}

/** What a Session records, a field at a time: the Archive's own type is the truth, and a test holds this to it. */
export const sessionFields = [
  { name: 'version', says: 'the Session\'s shape; the Radio plays only its own version' },
  { name: 'song', says: "the Song's number" },
  { name: 'name', says: "the name the mind gave it, whose slug is its address" },
  { name: 'mood', says: "the weather it is sung in" },
  { name: 'mode', says: 'the mode of its tune' },
  { name: 'tempo', says: 'beats a minute' },
  { name: 'sound', says: "how the band under the voice sounds" },
  { name: 'choir', says: 'who sings it' },
  { name: 'thought', says: 'what the mind thought of it, afterwards' },
  { name: 'iterations', says: 'its iterations, each with its parts: their kinds, their lines and the time they are typed' },
  { name: 'recordings', says: 'the takes it names, and the beds, kept in the Archive' },
  { name: 'guides', says: 'the hummed guides the beds were grown from' },
  { name: 'seconds', says: 'how long it lasts' },
] as const
