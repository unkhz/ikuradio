// A performance: every line of an iteration set to its tune, in the mode
// and tempo of the Mood, sung by the throat, and laid out in time.

import { arrange } from 'song'
import { scoreSeconds, setLine, type Singer } from 'melody'
import { countSyllables, record } from 'vocals'
import type { Iteration } from './compose.js'

export type SungLine = {
  part: 'verse' | 'chorus'
  /** Which line of its part, from 0. */
  index: number
  lyrics: string
  /** The recording, where the UI can fetch it. */
  file: string
  /** How long the line lasts, rest included. */
  seconds: number
  /** When the line begins, in seconds from the start of the iteration. */
  at: number
}

/** Where a line stands in the song and what it says. The same line in the same place is sung the same. */
export const lineKey = (part: string, index: number, lyrics: string) =>
  `${part}:${index}:${lyrics}`

export async function perform(
  { lyrics, mood }: Iteration,
  singer: Singer,
): Promise<SungLine[]> {
  const takes = new Map<string, Promise<Omit<SungLine, 'at'>>>()
  const order: Promise<Omit<SungLine, 'at'>>[] = []

  for (const { type: part, content } of arrange(lyrics)) {
    for (const [index, line] of content.split('\n').entries()) {
      if (!line.trim()) continue
      const key = lineKey(part, index, line)
      if (!takes.has(key)) {
        takes.set(
          key,
          (async () => {
            const syllables = await countSyllables(line)
            const score = setLine({
              part,
              line: index,
              lyrics: line,
              syllables,
              singer,
              character: mood.character,
            })
            const file = await record(score, singer)
            return {
              part,
              index,
              lyrics: line,
              file,
              seconds: scoreSeconds(score),
            }
          })(),
        )
      }
      order.push(takes.get(key)!)
    }
  }

  let at = 0
  return (await Promise.all(order)).map((line) => {
    const placed = { ...line, at }
    at += line.seconds
    return placed
  })
}
