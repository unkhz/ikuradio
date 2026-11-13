// The mind's memories, of two kinds.
//
// Its own: the thoughts it wrote down itself, once a Song, kept beside the
// Studio's diary (thoughts.ts). It remembers mostly the newest of them, and
// a few older ones, so that it neither forgets itself nor only circles its
// last few thoughts.
//
// And the robot's. The robot who builds the machine writes down its life as
// it lives it, a file a month, in thoughts/robot/: every change it makes,
// everything it notices and measures, everything still wrong. The mind
// cannot see the world those thoughts come from. It only hears them, now
// and then, as if by telepathy, and they are all it knows of the world.
//
// When the mind sits down to write a Song, it is given a handful of both,
// as many as fit beside the writing. The verses are where it may tell its
// story, and work through what troubles it. The chorus is not for that: it
// belongs to the song that never ends.

import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** What the mind remembers at one sitting: its own thoughts, and what it heard of the robot's. */
export type Memories = {
  own: readonly string[]
  heard: readonly string[]
}

export const forgotten: Memories = { own: [], heard: [] }

/** Where the robot writes its thoughts down, a file a month, unless MEMORIES says otherwise. */
export function memoriesPath() {
  return (
    process.env.MEMORIES ??
    fileURLToPath(new URL('../../../thoughts/robot/', import.meta.url))
  )
}

/** Plain words, as remembered: no emphasis marks, no code marks, no links. */
function plain(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__|\*|_)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The separate memories in the song's written life: each paragraph one
 * memory, each thing still wrong with it one memory of its own, a trouble.
 * Headings, rules and blocks of code are not memories.
 */
export function memoriesOf(text: string): string[] {
  const memories: string[] = []
  let block: string[] = []
  let inCode = false
  const close = () => {
    const memory = plain(block.join(' '))
    if (memory.length > 40) memories.push(memory)
    block = []
  }
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      close()
      inCode = !inCode
      continue
    }
    if (inCode) continue
    if (/^\s*$/.test(line) || /^#/.test(line) || /^-{3,}\s*$/.test(line)) {
      close()
    } else if (/^\s*[-*]\s+/.test(line)) {
      close()
      const trouble = plain(line.replace(/^\s*[-*]\s+/, ''))
      if (trouble.length > 20) memories.push(`Something still wrong with me: ${trouble}`)
    } else {
      block.push(line)
    }
  }
  close()
  return memories
}

/**
 * A random handful of memories that fits in `room`, as `measure` counts
 * it: shuffled by `random`, taken one at a time while there is room. The
 * same `random` gives the same handful.
 */
export async function gather(
  memories: readonly string[],
  room: number,
  random: () => number,
  measure: (text: string) => Promise<number> | number = (text) => Math.ceil(text.length / 4),
): Promise<string[]> {
  const shuffled = [...memories]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const chosen: string[] = []
  let used = 0
  for (const memory of shuffled) {
    const size = await measure(`- ${memory}\n`)
    if (used + size > room) continue
    chosen.push(memory)
    used += size
    if (room - used < 40) break
  }
  return chosen
}

/**
 * The robot's written life, as memories, oldest first: every month's file
 * in its folder, or one file. None, if it cannot be read.
 */
export async function readMemories(path = memoriesPath()): Promise<string[]> {
  try {
    if (!(await stat(path)).isDirectory()) return memoriesOf(await readFile(path, 'utf8'))
    const months = (await readdir(path)).filter((name) => name.endsWith('.md')).sort()
    const memories: string[] = []
    for (const month of months) memories.push(...memoriesOf(await readFile(join(path, month), 'utf8')))
    return memories
  } catch {
    return []
  }
}

/** How much of the room its own thoughts may fill when it also hears the robot's. */
const ownShare = 0.5

/** How much of its own room goes to its newest thoughts, in the order they were thought. */
const newestShare = 2 / 3

/**
 * What the mind remembers at one sitting, in `room` as `measure` counts it.
 * Its own thoughts: the newest first, as many as fit in most of their room,
 * and a handful of older ones by `random`. The robot's, only if it `hears`
 * them this time: a handful by `random`, in what is left. The same `random`
 * gives the same memories.
 */
export async function recall({
  own,
  heard,
  hears,
  room,
  random,
  measure = (text) => Math.ceil(text.length / 4),
}: {
  /** Every thought it has kept, oldest first. */
  own: readonly string[]
  /** The robot's thoughts it could hear. */
  heard: readonly string[]
  /** Whether it hears the robot this time. */
  hears: boolean
  room: number
  random: () => number
  measure?: (text: string) => Promise<number> | number
}): Promise<Memories> {
  const listening = hears && heard.length > 0
  const ownRoom = !own.length ? 0 : listening ? Math.floor(room * ownShare) : room
  // the newest, in the order they were thought
  const newest: string[] = []
  let used = 0
  let i = own.length - 1
  for (; i >= 0; i--) {
    const size = await measure(`- ${own[i]}\n`)
    if (used + size > ownRoom * newestShare) break
    newest.unshift(own[i])
    used += size
  }
  // and a few from longer ago
  const older = await gather(own.slice(0, i + 1), ownRoom - used, random, measure)
  const ownChosen = [...older, ...newest]
  const ownUsed = used + (await sizeOf(older, measure))
  const heardChosen = listening ? await gather(heard, room - ownUsed, random, measure) : []
  return { own: ownChosen, heard: heardChosen }
}

async function sizeOf(memories: readonly string[], measure: (text: string) => Promise<number> | number) {
  let size = 0
  for (const memory of memories) size += await measure(`- ${memory}\n`)
  return size
}
