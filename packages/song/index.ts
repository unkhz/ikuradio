import * as original from './verses.js'
import { numberToWords } from './lib/numbers.js'
import { editVerse } from './lib/edit.js'

const moods = [
  'eternity',
  'death',
  'spring',
  'light',
  'spirit',
  'human evolution',
  'transcendence',
]
function pickNewMood(): string | undefined {
  if (Math.random() > 0.67) {
    return moods[Math.floor(Math.random() * moods.length)]
  }
}

function changeMood(instruction: string, mood: string) {
  return `${instruction} Talk intensely about ${mood}.`
}

const verseInstruction = [
  'The input is a verse of a song that never ends.',
  'Write the next verse of the song: four lines, where the first two lines rhyme with each other and the last two lines rhyme with each other.',
  'Each line has between eight and fourteen syllables.',
].join(' ')

async function pickVariation(input: string, mood?: string) {
  return editVerse(
    input,
    mood ? changeMood(verseInstruction, mood) : verseInstruction,
    1.2,
  )
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

const previous = {
  firstVerse: original.firstVerse,
  secondVerse: original.secondVerse,
  thirdVerse: original.thirdVerse,
  chorus: original.chorus,
  finalChorus: original.finalChorus,
}

async function generateIteration(iteration: bigint) {
  if (iteration === 0n) {
    return [
      deIndent(original.chorus),
      deIndent(original.firstVerse),
      deIndent(original.secondVerse),
      deIndent(original.thirdVerse),
      deIndent(original.finalChorus),
    ]
  }
  const mood = pickNewMood()
  return Promise.all([
    pickChorus(previous.chorus, iteration),
    pickVariation(previous.firstVerse, mood),
    pickVariation(previous.secondVerse, mood),
    pickVariation(previous.thirdVerse, mood),
    pickVariation(previous.finalChorus, mood),
  ])
}

export type SongPart = {
  type: 'verse' | 'chorus'
  index: number
  content: string
}

export default async function song(iteration: bigint): Promise<SongPart[]> {
  const [chorus, firstVerse, secondVerse, thirdVerse, finalChorus] =
    await generateIteration(iteration)

  Object.assign(previous, {
    chorus,
    firstVerse,
    secondVerse,
    thirdVerse,
    finalChorus,
  })

  return [
    { type: 'verse', index: 0, content: firstVerse },
    { type: 'chorus', index: 1, content: chorus },
    { type: 'verse', index: 2, content: secondVerse },
    { type: 'chorus', index: 3, content: chorus },
    { type: 'verse', index: 4, content: thirdVerse },
    { type: 'verse', index: 5, content: finalChorus },
  ]
}
