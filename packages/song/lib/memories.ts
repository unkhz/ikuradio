// The mind's memories. The song has written down its life as it lived it:
// every change made to it, everything it noticed and measured, everything
// still wrong with it, in thoughts.md. When the mind sits down to write a
// Song, it is given a handful of those memories, chosen at random and as
// many as fit in its memory beside the writing, to think about while it
// writes. The verses are where it may tell its story, and work through
// what troubles it. The chorus is not for that: it belongs to the song that
// never ends.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** Where the song's life is written down, unless MEMORIES says otherwise. */
export function memoriesPath() {
  return (
    process.env.MEMORIES ??
    fileURLToPath(new URL('../../../thoughts.md', import.meta.url))
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

/** The song's written life, as memories. None, if it cannot be read. */
export async function readMemories(path = memoriesPath()): Promise<string[]> {
  try {
    return memoriesOf(await readFile(path, 'utf8'))
  } catch {
    return []
  }
}
