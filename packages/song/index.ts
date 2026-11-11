import * as original from './verses.js'
import { numberToWords } from './lib/numbers.js'
import { editVerse } from './lib/edit.js'
import { lastWord, rhymes } from './lib/rhyme.js'
import { known } from './lib/known.js'

const verseInstruction = [
  'The input is a verse of a song that never ends.',
  'Write the next verse of the song: four lines, where the first two lines rhyme with each other and the last two lines rhyme with each other.',
  'Each line has between eight and fourteen syllables.',
].join(' ')

/** The weather the words are written in. Every verse is written in it, every time. */
function inMood(instruction: string, mood: readonly string[]) {
  return `${instruction} The mood of the song is ${mood.join(' and ')}: let every line live in it.`
}

async function pickVariation(input: string, mood: readonly string[]) {
  return editVerse(input, inMood(verseInstruction, mood), 1.2)
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
  const varied = await editVerse(
    [opening, ...rest].join('\n'),
    [
      'The input is the chorus of a song that never ends.',
      'Keep the first line exactly as it is.',
      `Write a new second line whose last word rhymes with "${age}", the last word of the first line. Keep its spirit, that the song goes on and on, but say it in new words, not only with a new last word.`,
      hint,
      'Change a few words in the third and fourth lines but keep their meaning, their tone and their rhyme with each other.',
      'Keep the last line ending with "the song that never ends".',
    ]
      .filter(Boolean)
      .join(' '),
    1,
    {
      mayRepeat: true,
      patience: 12,
      // the second line must rhyme, and must not grow: a small mind, asked
      // for a rhyme, will otherwise just add one more word to the end
      accept: ([, second = '']) =>
        second.split(/\s+/).length <= longestSecondLine &&
        // a new line, not the old one with its last word swapped
        withoutLastWord(second) !== withoutLastWord(before) &&
        (!dictionary ||
          (dictionary.rhymes(lastWord(second), age, offered?.loosely) &&
            (!plain || plain.has(lastWord(second))))),
    },
  )
  const [, ...varying] = varied.split('\n')
  return [opening, ...varying].join('\n')
}

/** A line without its last word, as it sounds, to hear whether only the rhyme changed. */
function withoutLastWord(line: string) {
  return line
    .toLowerCase()
    .replace(/[^a-z' ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, -1)
    .join(' ')
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
  const [chorus, firstVerse, secondVerse, thirdVerse, finalChorus] =
    await Promise.all([
      pickChorus(previous.chorus, iteration),
      pickVariation(previous.firstVerse, mood),
      pickVariation(previous.secondVerse, mood),
      pickVariation(previous.thirdVerse, mood),
      pickVariation(previous.finalChorus, mood),
    ])
  return { chorus, firstVerse, secondVerse, thirdVerse, finalChorus }
}

export type SongPart = {
  type: 'verse' | 'chorus'
  index: number
  content: string
}

/** Lays the words out in the order they are sung. */
export function arrange(lyrics: Lyrics): SongPart[] {
  return [
    { type: 'verse', index: 0, content: lyrics.firstVerse },
    { type: 'chorus', index: 1, content: lyrics.chorus },
    { type: 'verse', index: 2, content: lyrics.secondVerse },
    { type: 'chorus', index: 3, content: lyrics.chorus },
    { type: 'verse', index: 4, content: lyrics.thirdVerse },
    { type: 'verse', index: 5, content: lyrics.finalChorus },
  ]
}
