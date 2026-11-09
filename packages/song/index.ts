import * as original from './verses.js'
import { numberToWords } from './lib/numbers.js'
import { editVerse } from './lib/edit.js'

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

async function pickChorus(chorus: string, iteration: bigint) {
  const opening = chorusOpening(iteration)
  const [, ...rest] = chorus.split('\n')
  const varied = await editVerse(
    [opening, ...rest].join('\n'),
    [
      'The input is the chorus of a song that never ends.',
      'Keep the first line exactly as it is.',
      `Rewrite the second line so that it rhymes with the last word of the first line, "${opening.split(' ').at(-1)?.replace(/,$/, '')}", and keep its spirit: the song goes on and on.`,
      'Change a few words in the third and fourth lines but keep their meaning, their tone and their rhyme with each other.',
      'Keep the last line ending with "the song that never ends".',
    ].join(' '),
    1,
    { mayRepeat: true },
  )
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
