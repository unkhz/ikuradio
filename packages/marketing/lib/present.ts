// The moment a verse is asked for: what the mind has in it, as of the Song it is asked about. The words the
// Song's last iteration leaned on and the words it leaned on throughout, the thought the mind kept of it, and
// a handful of the robot's, heard by telepathy, chosen at random each time. The Archive does not keep these
// with a Song, so they are made again from its words, whenever a prompt is asked for.

import { focusesOf, gather, longWear, stemOf, worn, wornDeep, type Focus, type Memories } from 'song'
import type { Session } from 'archive'

/** The words of one iteration, a line to a line. */
const wordsOfIteration = (iteration: Session['iterations'][number]): string =>
  iteration.parts.flatMap(({ lines }) => lines.map(({ text }) => text)).join('\n')

export type Present = { memories: Memories; focus?: Focus; resting: string[]; deep: string[] }

/**
 * What the mind would have in it for a song in `mood`. `sessions` are the Songs whose words are looked
 * through, oldest first; `own` the thoughts the mind has of them, oldest first; `heard` what the robot has
 * written, of which it hears `telepathy` (two) thoughts, drawn by `random`. It always hears the robot here:
 * telepathy is the spice of a prompt asked for.
 */
export async function presentOf({
  sessions,
  own,
  heard,
  mood,
  telepathy = 2,
  random = Math.random,
}: {
  sessions: readonly Session[]
  own: readonly string[]
  heard: readonly string[]
  mood: readonly string[]
  telepathy?: number
  random?: () => number
}): Promise<Present> {
  // the Song's own thoughts, and two of the robot's, drawn at random
  const memories: Memories = { own, heard: (await gather(heard, Number.MAX_SAFE_INTEGER, random)).slice(0, telepathy) }
  const iterations = sessions.flatMap(({ iterations }) => iterations.map(wordsOfIteration))
  // a Song has only a few iterations: a word in more than half of them is worn deep in it
  const deep = wornDeep(iterations.slice(-longWear).map((words) => [words]), mood, { least: Math.min(8, iterations.length) })
  const last = iterations.at(-1)
  // each word is rested once: a word worn deep is told as that
  const resting = last ? worn([last], mood).filter((word) => !deep.includes(stemOf(word))) : []
  const focuses = focusesOf(memories)
  const focus = focuses.length ? focuses[Math.floor(random() * focuses.length)] : undefined
  return { memories, focus, resting, deep }
}
