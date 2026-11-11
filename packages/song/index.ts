import * as original from './verses.js'
import { numberToWords } from './lib/numbers.js'
import { editVerse } from './lib/edit.js'
import { lastWord, rhymes } from './lib/rhyme.js'
import { known } from './lib/known.js'
import { leansOn, overlap, worn } from './lib/wear.js'

const verseInstruction = [
  'The input is a verse of a song that never ends.',
  'Write the next verse of the song: four lines, where the first two lines rhyme with each other and the last two lines rhyme with each other.',
  'Each line has between eight and fourteen syllables.',
].join(' ')

/** The weather the words are written in. Every verse is written in it, every time. */
function inMood(instruction: string, mood: readonly string[]) {
  return `${instruction} The mood of the song is ${mood.join(' and ')}: let every line live in it.`
}

/** How many resting words a verse may still use: one may slip in, as words do. */
const slips = 1

async function pickVariation(
  input: string,
  mood: readonly string[],
  resting: readonly string[],
) {
  const rest = resting.length
    ? ` These words have been sung too often lately; let them rest, and find others: ${resting.join(', ')}.`
    : ''
  return editVerse(input, inMood(verseInstruction, mood) + rest, 1.2, {
    accept: (lines) => leansOn(lines, resting) <= slips,
  })
}

/**
 * The first line of the chorus is not left to the mind. It is the one thing
 * in the song that must always be exactly right: how long it has been going.
 */
export function chorusOpening(iteration: bigint) {
  return `This is the song, iteration ${numberToWords(iteration + 1n)},`
}

/**
 * The chorus is varied lightly, except for its second line, which must
 * rhyme with the song's age in the first: one and begun, two and true. The
 * mind is offered words that rhyme, from the throat's pronouncing
 * dictionary, and whatever it writes is heard against that dictionary
 * before it is sung. Without the dictionary, the mind is only asked.
 */
/** In words: a little longer than the line a human wrote, "Yes, it goes on and on, it's just begun". */
const longestSecondLine = 12

/** A second line sharing this much of the last one's words is the same line wearing a new rhyme. */
const sameShape = 0.5

/** What the mind is shown where the second line was. */
const gap = '...'

async function pickChorus(chorus: string, iteration: bigint) {
  const opening = chorusOpening(iteration)
  const age = lastWord(opening)
  const [, ...rest] = chorus.split('\n')
  const dictionary = await rhymes().catch(() => undefined)
  // the dictionary is full of names; only the words the mind knows well are
  // offered, and only those are sung
  const pool = dictionary?.offer(age, 400)
  const plain = pool ? await known(pool.words) : undefined
  const offered = pool && { words: [...(plain ?? pool.words)].slice(0, 30), loosely: pool.loosely }
  const [before = ''] = rest
  const hint = offered?.words.length
    ? `End the second line with one of these words, which ${offered.loosely ? `share the vowel of "${age}"` : `rhyme with "${age}"`}: ${offered.words.join(', ')}.`
    : ''
  const instruction = [
    'The input is the chorus of a song that never ends. Its second line is missing.',
    'Keep the first line exactly as it is.',
    `Write the missing second line, whose last word rhymes with "${age}", the last word of the first line. Its spirit is that the song goes on and on; say it in your own words.`,
    hint,
    'Change a few words in the third and fourth lines but keep their meaning, their tone and their rhyme with each other.',
    'Keep the last line ending with "the song that never ends".',
  ]
    .filter(Boolean)
    .join(' ')
  // the old second line is not shown: what the mind cannot see, it cannot copy
  const input = [opening, gap, ...rest.slice(1)].join('\n')
  const sings = (second: string) =>
    second.split(/\s+/).length <= longestSecondLine &&
    second !== gap &&
    (!dictionary ||
      (dictionary.rhymes(lastWord(second), age, offered?.loosely) &&
        (!plain || plain.has(lastWord(second)))))
  // the second line must rhyme, must not grow, and should be new, not the
  // old one's shape with a new rhyme pinned to it
  let varied = await editVerse(input, instruction, 1, {
    mayRepeat: true,
    patience: 12,
    accept: ([, second = '']) => sings(second) && overlap(second, before) < sameShape,
  })
  if (varied === input) {
    // a line that rhymes is better than a line that is new
    varied = await editVerse(input, instruction, 1, {
      mayRepeat: true,
      patience: 8,
      accept: ([, second = '']) => sings(second),
    })
  }
  if (varied === input) {
    // the mind could not find a rhyme at all; the old line is sung again
    varied = [opening, ...rest].join('\n')
  }
  const [, ...varying] = varied.split('\n')
  return [opening, ...varying].join('\n')
}

function deIndent(part: string) {
  const lines = part.split('\n')
  return lines.map((line) => line.replace(/^\s+/, '')).join('\n')
}

/** The words of one iteration. */
export type Lyrics = {
  firstVerse: string
  secondVerse: string
  thirdVerse: string
  chorus: string
  finalChorus: string
}

/** The words a human wrote, in 2023, before the song began to write itself. */
export const firstLyrics: Lyrics = {
  firstVerse: deIndent(original.firstVerse),
  secondVerse: deIndent(original.secondVerse),
  thirdVerse: deIndent(original.thirdVerse),
  chorus: deIndent(original.chorus),
  finalChorus: deIndent(original.finalChorus),
}

/**
 * Writes the words of an iteration from the words of the one before it, in
 * the given Mood. The verses drift; the chorus stays, and counts.
 */
export async function writeLyrics(
  iteration: bigint,
  mood: readonly string[],
  previous: Lyrics,
): Promise<Lyrics> {
  // the words the last iteration leaned on most rest in this one
  const resting = worn(
    [previous.firstVerse, previous.secondVerse, previous.thirdVerse, previous.finalChorus],
    mood,
  )
  const [chorus, firstVerse, secondVerse, thirdVerse, finalChorus] =
    await Promise.all([
      pickChorus(previous.chorus, iteration),
      pickVariation(previous.firstVerse, mood, resting),
      pickVariation(previous.secondVerse, mood, resting),
      pickVariation(previous.thirdVerse, mood, resting),
      pickVariation(previous.finalChorus, mood, resting),
    ])
  return { chorus, firstVerse, secondVerse, thirdVerse, finalChorus }
}

export type SongPart = {
  /** A bridge has no words: it is music between a verse and a chorus, hummed or not. */
  type: 'verse' | 'chorus' | 'bridge'
  /** Where the part stands in the iteration, from 0. */
  index: number
  /** The words, a line each. A bridge has one line, and no words in it. */
  content: string
}

/**
 * Lays the parts out in the order they are sung. Wherever the song turns
 * from a verse to the chorus, or back, a bridge carries it across.
 */
export function arrange(lyrics: Lyrics): SongPart[] {
  const sung: Omit<SongPart, 'index'>[] = [
    { type: 'verse', content: lyrics.firstVerse },
    { type: 'chorus', content: lyrics.chorus },
    { type: 'verse', content: lyrics.secondVerse },
    { type: 'chorus', content: lyrics.chorus },
    { type: 'verse', content: lyrics.thirdVerse },
    { type: 'verse', content: lyrics.finalChorus },
  ]
  return sung
    .flatMap((part, i) => {
      const before = sung[i - 1]
      return before && before.type !== part.type
        ? [{ type: 'bridge' as const, content: '' }, part]
        : [part]
    })
    .map((part, index) => ({ ...part, index }))
}

/** The parts with words in them, as a reader would want them. */
export function words(lyrics: Lyrics): SongPart[] {
  return arrange(lyrics).filter(({ type }) => type !== 'bridge')
}
