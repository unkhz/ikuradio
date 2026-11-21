// What a Song makes, as the pages of the Tune, the Lyrics, the Score, the Beds and the Song say it (plan "Evolution of
// Song", step 7): illustrated from the first tune and sample words, each read from the package that owns it. The words
// are a sample, and their syllables are counted by a rough rule (a vowel, and the letters round it), since the throat
// that counts them as a person would does not run here.

import { bridgeBeats, chorusHook, composeGuide, evolve, firstTune, fitToCount, growOnReciting, modes, roaming, spacing, timedLine, variations, wrongness, type Phrase, type Tune } from 'melody'
import { arrange, chorusOpening, firstLyrics, type Lyrics } from 'song'
import { readArrangements, type Part, type PartRecord } from 'parts'
import { layoutOf } from './layout.js'

type Syllables = { stresses: number[]; comma?: boolean }
export type Word = { text: string; syllables: string[]; stresses: number[]; comma: boolean }

/** The pieces of a word, a vowel and the letters round it: a rough count of its syllables. */
export function piecesOf(word: string): string[] {
  const letters = word.replace(/[^a-z']/gi, '')
  const pieces = letters.match(/[^aeiouy']*[aeiouy]+(?:'?s$|[^aeiouy]+$)?/gi)
  // a silent final e does not make a syllable of its own
  if (pieces && pieces.length > 1 && /^[^aeiouy]*e$/i.test(pieces.at(-1)!) ) pieces.pop()
  return pieces?.length ? pieces : [letters]
}

/** Words as the bar fit sees them: the first syllable of a word of more than one is main, a short word is light, a long one main. */
export function wordsOf(line: string): Word[] {
  return line
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((raw) => {
      const syllables = piecesOf(raw)
      const text = raw.replace(/[,.;:!?]+$/, '')
      const stresses = syllables.map((_, i) => (syllables.length === 1 ? (text.length > 3 ? 1 : 0) : i === 0 ? 1 : 0))
      return { text, syllables, stresses, comma: /[,;:.!?]$/.test(raw) }
    })
}

const forFit = (words: readonly Word[]): Syllables[] => words.map(({ stresses, comma }) => ({ stresses, ...(comma ? { comma } : {}) }))

/** How long a phrase is, its rest included, in beats. */
export const lengthOf = (phrase: Phrase) => phrase.notes.reduce((sum, [, beats]) => sum + beats, 0) + phrase.rest

/** A phrase as a page draws it. */
export type Drawn = { notes: [number, number][]; rest: number; reciting?: number }
const drawn = (phrase: Phrase, reciting?: number): Drawn => ({ notes: phrase.notes.map(([degree, beats]): [number, number] => [degree, beats]), rest: phrase.rest, ...(reciting !== undefined ? { reciting } : {}) })

// ---- the Tune

/** How many Songs the tune is evolved for, to show a verse moving step by step. */
const evolved = 6

/** The tune: its phrases as drawn, a few Songs of the verse evolving while the chorus stays, and a Song's Variations. */
export function tuneAnswer() {
  const steps: Tune[] = [firstTune]
  for (let i = 1; i <= evolved; i++) steps.push(evolve(steps[i - 1]!, `composer:${i}`))
  const changed = (a: Phrase, b: Phrase) => a.notes.map(([degree, beats], i) => degree !== b.notes[i]?.[0] || beats !== b.notes[i]?.[1])
  const refrain = firstTune.chorus.map((phrase, i) => drawn(phrase, chorusHook[i]?.reciting))
  return {
    refrain,
    refrainStays: steps.every((tune) => JSON.stringify(tune.chorus) === JSON.stringify(firstTune.chorus)),
    evolution: steps.map((tune, step) => ({
      step,
      phrases: tune.verse.map((phrase, i) => ({ ...drawn(phrase), changed: step ? changed(steps[step - 1]!.verse[i]!, phrase) : phrase.notes.map(() => false) })),
    })),
    variations: variations(firstTune, 4, 'composer', { ornaments: 1, steps: 1 }).map((tune, v) => ({
      variation: v,
      phrases: tune.verse.map((phrase, i) => ({ ...drawn(phrase), changed: changed(firstTune.verse[i]!, phrase) })),
    })),
  }
}

// ---- the Lyrics

const sampleWordiness = [0.2, 0.5, 0.9]
const written = (part: Part) => part.words === 'written'

/** The five fields of Lyrics, the instances of the Arrangement each fills, each line's count at a tempo, and the Song's age growing. */
export function lyricsAnswer(records: readonly PartRecord[], arrangementsDir: string, tempo: number, rate = 6) {
  const fields = Object.keys(firstLyrics) as (keyof Lyrics)[]
  // each field is given its own name for a text, so that arrange() shows where every field is sung
  const named = Object.fromEntries(fields.map((field) => [field, field])) as Lyrics
  const sung = arrange(named)
  const first = readArrangements(records, arrangementsDir).find(({ state }) => state === 'active')
  const fills = first
    ? first.arrangement.instances.map(({ name, part }, i) => ({ instance: name, part, field: sung[i]?.content ? (sung[i]!.content as keyof Lyrics) : undefined }))
    : []
  const lines = records.filter(({ part }) => written(part)).map(({ part }) => ({
    part: part.id,
    lines: [0, 1, 2, 3].map((line) => ({
      line,
      counts: sampleWordiness.map((wordiness) => ({ wordiness, ...part.measure({ line, tune: firstTune, tempo, rate, parameters: { wordiness } }) })),
    })),
  }))
  return { fields, arrangement: first?.arrangement.id, fills, tempo, rate, lines, age: [1, 12, 2548].map((iteration) => ageOf(BigInt(iteration), tempo, rate)) }
}

/** The Song's age as the first line of the chorus: its words, and how many bars it grows past its phrase on the reciting note. */
export function ageOf(iteration: bigint, tempo: number, rate: number) {
  const text = chorusOpening(iteration)
  const words = wordsOf(text)
  const phrase = { ...firstTune.chorus[0]!, reciting: chorusHook[0]!.reciting }
  const fitted = growOnReciting(phrase, forFit(words), spacing(tempo, rate))
  return {
    iteration: Number(iteration),
    text,
    syllables: words.reduce((sum, word) => sum + word.syllables.length, 0),
    grown: fitted ? Math.round((lengthOf(fitted) - lengthOf(firstTune.chorus[0]!)) / 4) : undefined,
  }
}

// ---- the Score

/** Sample words, a line to each phrase of a verse: the words of a Song the radio sang. */
export const sampleVerse = ["In the crystal memory of a winter's night,", 'I sang of a snowflake in defiance, bright.', 'It did not melt, as others swiftly did,', 'Eternity in fragile form, my bid.']

/** A line fitted to its phrase: its words in syllables, the notes they stand on, and whether it fitted, grew, or did not. */
export function fittedLine(phrase: Phrase, line: string, tempo: number, rate: number) {
  const words = wordsOf(line)
  const k = spacing(tempo, rate)
  const fit = fitToCount(phrase, forFit(words), k)
  return {
    words,
    syllables: words.reduce((sum, word) => sum + word.syllables.length, 0),
    phrase: drawn(phrase, (phrase as { reciting?: number }).reciting),
    fitted: fit ? drawn(fit.phrase) : undefined,
    grown: fit?.grown ?? 0,
    fits: Boolean(fit),
  }
}

/** The grid a voice sings on, and a verse's four sample lines and the chorus's first, as the Score sets them. */
export function scoreAnswer(tempo: number, rate: number) {
  const k = spacing(tempo, rate)
  return {
    tempo,
    rate,
    k,
    // sixteenths of a beat, and a syllable no sooner than k of them after the one before
    lines: sampleVerse.map((line, i) => fittedLine(firstTune.verse[i]!, line, tempo, rate)),
    // the first line of the chorus, as the Song's age, which grows when the words outgrow the phrase
    age: [1, 12, 2548].map((iteration) => {
      const opening = chorusOpening(BigInt(iteration))
      const words = wordsOf(opening)
      const phrase = { ...firstTune.chorus[0]!, reciting: chorusHook[0]!.reciting }
      const grown = growOnReciting(phrase, forFit(words), k)
      return { iteration, text: opening, words, phrase: drawn(phrase, chorusHook[0]!.reciting), fitted: grown ? drawn(grown) : undefined, grownBars: grown ? Math.round((lengthOf(grown) - lengthOf(firstTune.chorus[0]!)) / 4) : undefined }
    }),
  }
}

// ---- the Beds

/** The kind of a bed for an instance: a part with words keeps its name; one with none is told the parts either side of it. */
export const kindOf = (part: Part, before?: string, after?: string) => (part.words === 'none' ? `${part.id}:${before ?? 'start'}>${after ?? 'end'}` : part.id)

/** The kinds of bed an Arrangement asks for, and the guide the first section's lines make. */
export function bedsAnswer(records: readonly PartRecord[], arrangementsDir: string, tempo: number) {
  const parts = new Map(records.map(({ part }) => [part.id, part]))
  const first = readArrangements(records, arrangementsDir).find(({ state }) => state === 'active')
  const layout = first ? layoutOf(first.arrangement, parts, firstTune, tempo) : undefined
  const kinds = layout?.instances.map((instance) => ({ instance: instance.name, part: instance.part, kind: kindOf(parts.get(instance.part)!, instance.before, instance.after), beats: instance.beats, seconds: instance.seconds })) ?? []
  // the guide of a verse: its four sample lines, as timed syllables, and the chords that change where the words lean
  let at = 0
  const syllables = sampleVerse.flatMap((line, i) => {
    const fitted = fittedLine(firstTune.verse[i]!, line, tempo, 6)
    const notes = fitted.fitted?.notes ?? firstTune.verse[i]!.notes
    const timed = timedLine(fitted.words.map(({ stresses, comma }) => ({ stresses, comma })), notes, at)
    at += lengthOf(firstTune.verse[i]!) + (fitted.grown ? 4 * fitted.grown : 0)
    return timed
  })
  const guide = composeGuide({ syllables, beats: at, bpm: tempo, mode: modes.aeolian, ending: 'half', random: wrongness('composer:guide'), progression: roaming })
  return {
    tempo,
    kinds,
    bridgeBeats,
    guide: { beats: guide.beats, chords: guide.chords, furthest: guide.furthest, lower: guide.lower, upper: guide.upper, syllables: syllables.length },
  }
}

// ---- the Song

/** What a Song is made of once it is a Session, and where each part of it comes from: the parts in order, with their kinds, their words, their timing. */
export function songAnswer(records: readonly PartRecord[], arrangementsDir: string, tempo: number) {
  const parts = new Map(records.map(({ part }) => [part.id, part]))
  const first = readArrangements(records, arrangementsDir).find(({ state }) => state === 'active')
  const fields = Object.keys(firstLyrics) as (keyof Lyrics)[]
  const sung = arrange(Object.fromEntries(fields.map((field) => [field, field])) as Lyrics)
  const layout = first ? layoutOf(first.arrangement, parts, firstTune, tempo) : undefined
  return {
    arrangement: first?.arrangement.id,
    tempo,
    parts: (layout?.instances ?? []).map((instance, i) => ({
      index: instance.index,
      instance: instance.name,
      part: instance.part,
      kind: kindOf(parts.get(instance.part)!, instance.before, instance.after),
      words: sung[i]?.content || undefined,
      start: instance.startSeconds,
      seconds: instance.seconds,
      ending: instance.ending,
    })),
    seconds: layout?.seconds ?? 0,
    // the fields of a Session, said once here so that a page can show them; a test holds them against the Archive's own type
    session: sessionFields,
  }
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
