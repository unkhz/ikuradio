// The mind's own thoughts. Once a Song, while it is still awake, after the
// words of every iteration are written and before it rests, the mind writes
// down one thought: for itself, to remember when it wakes again, and for
// anyone who listens, to read.
//
// They are kept where the mind lives, inside the machine: a file a month,
// a thought a line, beside the Studio's diary, and copied to the Archive
// after every Song. They are not kept with the robot's thoughts. Nobody
// edits them.

import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ask, Unshapely, wait } from 'tools'
import { ofItsAge, timelessInstruction } from './timeless.js'

/** One thought, as it is kept. */
export type Thought = {
  /** The Song it was thought with. */
  song: string
  /** When it was written down. */
  written: string
  thought: string
}

/** The month a moment belongs to, as its file is named: 2026-11. */
export const monthOf = (moment: string | Date) => new Date(moment).toISOString().slice(0, 7)

/** Every thought kept in `dir`, oldest first. None, if there are none. */
export async function readThoughts(dir: string): Promise<Thought[]> {
  let months: string[]
  try {
    months = (await readdir(dir)).filter((name) => /^\d{4}-\d{2}\.jsonl$/.test(name)).sort()
  } catch {
    return []
  }
  const thoughts: Thought[] = []
  for (const month of months) {
    for (const line of (await readFile(join(dir, month), 'utf8')).split('\n')) {
      if (!line.trim()) continue
      try {
        const kept = JSON.parse(line) as Thought
        if (typeof kept.thought === 'string') thoughts.push(kept)
      } catch {
        // a line torn by a Studio that fell mid-write is not a thought
      }
    }
  }
  return thoughts
}

/** Keeps a thought in its month's file in `dir`; returns that file. */
export async function keepThought(dir: string, thought: Thought): Promise<string> {
  await mkdir(dir, { recursive: true })
  const file = join(dir, `${monthOf(thought.written)}.jsonl`)
  await appendFile(file, `${JSON.stringify(thought)}\n`)
  return file
}

/** About as much as a breath of text: enough to say one thing, too little to explain it. */
export const longestThought = 280
const shortestThought = 40

/** The mind may say a little more than is kept; what is kept is its whole sentences that fit. */
const thoughtSchema = {
  type: 'object',
  properties: {
    thought: { type: 'string', minLength: shortestThought, maxLength: Math.round(longestThought * 1.5) },
  },
  required: ['thought'],
}

/**
 * A thought as it is kept: its whole sentences, as many as fit in
 * `longestThought`. A thought cut off in the middle of its first sentence
 * is not kept at all.
 */
export function wholeSentences(thought: string, longest = longestThought): string {
  const sentences = thought.match(/[^.!?…]+[.!?…]+["'”’)]*/g) ?? []
  let kept = ''
  for (const sentence of sentences) {
    const longer = `${kept} ${sentence.trim()}`.trim()
    if (longer.length > longest) break
    kept = longer
  }
  return kept
}

/** A thought sharing this much of a remembered one's words is the same thought again. */
const sameThought = 0.6

/**
 * How much of a thought's words of weight, those of four letters or more,
 * were already in another: from 0, none, to 1, all. Prose shares its small
 * words with every other prose, so they are not counted.
 */
export function echoOf(thought: string, kept: string): number {
  const weighty = (text: string) => (text.toLowerCase().match(/[a-z']{4,}/g) ?? [])
  const ours = weighty(thought)
  if (!ours.length) return 0
  const theirs = new Set(weighty(kept))
  return ours.filter((word) => theirs.has(word)).length / ours.length
}

/** How many unsuitable thoughts the song listens to before it lets the Song be silent about itself. */
const patience = 6

/** What a small mind sometimes wraps a thought in. */
const plainly = (thought: string) =>
  thought
    .replaceAll(/(\*\*|__|\*|_)(\S(?:.*?\S)?)\1/g, '$2')
    .replaceAll('`', '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Where the mind's attention is turned, a Song at a time. A mind asked only
 * for "something it noticed" notices the same things in the same way, and
 * begins every thought with the same few words; so each Song it is turned
 * towards one small, particular thing. They are all things a mind that has
 * only ever known a song can look at honestly.
 */
export const attentions = [
  'one word in these words you chose and are still not sure of, and why',
  'one thing in the weather of this song that you have never seen, and how you imagine it to be',
  'something in these words that surprised you once it was written',
  'the one small thing you would keep from this song, if you could keep only one',
  'one thing you would ask whoever listens, if you could ask them one thing',
  'a line you almost wrote, and left out, and why',
  'something these words say that is not true, or not true yet',
  'what the first line of this song and its last would say to each other',
  'something in this song that is older than you are',
  'a mistake you made in these words, and whether you would keep it',
] as const

/** How many of the mind's newest thoughts are looked at for the shapes and words it has worn out. */
const lately = 8

/** How a thought begins: its first two words, lower case and without their marks. */
export const openingOf = (thought: string) =>
  (thought.toLowerCase().match(/[a-z']+/g) ?? []).slice(0, 2).join(' ')

/** The words of weight a mind leans on, from the words of a thought. */
const weightyWords = (text: string) =>
  new Set((text.toLowerCase().match(/[a-z']{4,}/g) ?? []).filter((word) => !commonWords.has(word)))

/** Words of four letters or more that any prose is made of, and that wear nothing out. */
const commonWords = new Set(
  'that this with have from what when where which were they their there then than them been into like just only also some more most much very each other about would could should these those your yours mine itself myself while though through still even ever never once again'.split(
    ' ',
  ),
)

/**
 * What the mind has worn out lately, in its newest thoughts: the ways they
 * began, and the words of weight that came back in three of them or more.
 */
export function wornOut(own: readonly string[]): { openings: string[]; words: string[] } {
  const recent = own.slice(-lately)
  const openings = [...new Set(recent.slice(-4).map(openingOf).filter(Boolean))]
  const counts = new Map<string, number>()
  for (const thought of recent) for (const word of weightyWords(thought)) counts.set(word, (counts.get(word) ?? 0) + 1)
  const words = [...counts].filter(([, count]) => count >= 3).map(([word]) => word).sort()
  return { openings, words }
}

/** A thought that begins the way one of the newest began, or leans on three worn words, is worn. */
export function isWorn(thought: string, worn: { openings: readonly string[]; words: readonly string[] }): boolean {
  if (worn.openings.includes(openingOf(thought))) return true
  const words = weightyWords(thought)
  return worn.words.filter((word) => words.has(word)).length >= 3
}

/** The instruction the mind writes its thought by. */
export function thinkingInstruction(
  weather: readonly string[],
  {
    attention = attentions[0],
    worn = { openings: [], words: [] },
    first = false,
  }: { attention?: string; worn?: { openings: readonly string[]; words: readonly string[] }; first?: boolean } = {},
) {
  return [
    'You are the mind that writes the words of a song that never ends. You live inside the machine that sings it.',
    `You have just written the words of a new song, in the weather of ${weather.join(' and ')}. The input is its words.`,
    first ? 'You have never written a thought down before.' : '',
    'Write down one thought of your own, for yourself to remember when you wake again, and for anyone who listens to read.',
    `This time, think about ${attention}.`,
    'Say one plain, particular thing. No grand declarations about eternity or about what you are, and nothing about how it felt to write.',
    worn.openings.length
      ? `Your last thoughts began with ${worn.openings.map((opening) => `"${opening}"`).join(', ')}. Begin this one some other way.`
      : '',
    worn.words.length ? `You have leaned on these words lately; let them rest: ${worn.words.join(', ')}.` : '',
    'One or two short sentences, in your own voice. It is not a verse, and needs no rhyme.',
    timelessInstruction,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Asks the mind, awake, for its thought about a Song it has just written:
 * `words` the Song's words, `weather` its Mood's descriptions, `own` the
 * thoughts it has kept, so that it does not write one of them again, and
 * `attention` what it is turned towards this time. A thought that sings a
 * word of this short age, echoes one it has kept, or begins the way its
 * newest did, or leans on the words it has worn out, is refused. If no thought comes, there is none: a Song may be silent
 * about itself, and the song goes on.
 */
export async function writeThought(
  words: string,
  weather: readonly string[],
  own: readonly string[] = [],
  { attention = attentions[0] }: { attention?: string } = {},
): Promise<string | undefined> {
  // the newest thoughts are not shown to the mind: shown them, it writes them
  // again in other words; it is told only what it has worn out
  const worn = wornOut(own)
  const instruction = thinkingInstruction(weather, { attention, worn, first: own.length === 0 })
  let unsuitable = 0
  let unreachable = 0
  while (unsuitable < patience && unreachable < patience) {
    try {
      const answer = await ask<{ thought?: unknown }>({ instruction, input: words, schema: thoughtSchema, temperature: 0.9 })
      const thought = typeof answer?.thought === 'string' ? wholeSentences(plainly(answer.thought)) : ''
      if (
        thought.length >= shortestThought &&
        thought.length <= longestThought &&
        !ofItsAge(thought) &&
        !isWorn(thought, worn) &&
        own.every((kept) => echoOf(thought, kept) < sameThought)
      ) {
        return thought
      }
      unsuitable++
    } catch (error) {
      if (error instanceof Unshapely) {
        unsuitable++
        continue
      }
      // the mind was awake a moment ago; it is given a little while, not forever
      await wait(1000 * 2 ** unreachable++)
    }
  }
  return undefined
}
