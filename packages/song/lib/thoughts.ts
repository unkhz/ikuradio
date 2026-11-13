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
import { ofItsAge, timeless, timelessInstruction } from './timeless.js'

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

/** The instruction the mind writes its thought by. */
export function thinkingInstruction(weather: readonly string[], lastThoughts: readonly string[]) {
  return [
    'You are the mind that writes the words of a song that never ends. You live inside the machine that sings it.',
    `You have just written the words of a new song, in the weather of ${weather.join(' and ')}. The input is its words.`,
    lastThoughts.length
      ? `These are the last thoughts you wrote down:\n${lastThoughts.map((thought) => `- ${thought}`).join('\n')}\nDo not write any of them again.`
      : 'You have never written a thought down before.',
    'Write down one thought of your own about this song, or about yourself as you made it: for yourself to remember when you wake again, and for anyone who listens to read.',
    'Say one plain, particular thing: something you noticed, wondered about or felt while you wrote these words. No grand declarations about eternity or about what you are.',
    'One or two short sentences, in your own voice. It is not a verse, and needs no rhyme.',
    timelessInstruction,
  ].join('\n')
}

/**
 * Asks the mind, awake, for its thought about a Song it has just written:
 * `words` the Song's words, `weather` its Mood's descriptions, and `own` the
 * thoughts it has kept, so that it does not write one of them again. A
 * thought that sings a word of this short age, or echoes one it has kept,
 * is refused. If no thought comes, there is none: a Song may be silent
 * about itself, and the song goes on.
 */
export async function writeThought(
  words: string,
  weather: readonly string[],
  own: readonly string[] = [],
): Promise<string | undefined> {
  const lastThoughts = own.slice(-3).map(timeless)
  const instruction = thinkingInstruction(weather, lastThoughts)
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
