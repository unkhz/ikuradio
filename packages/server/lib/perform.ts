// A performance: every line of an iteration set to its tune, in the mode
// and tempo of the Mood, sung by the choir, and laid out in time.
//
// The lead sings every line. The rest of the choir joins in the chorus.
// Every voice sings its own take, a little wrong in its own way, and the
// takes are blended into one recording per line.

import { arrange } from 'song'
import { scoreSeconds, setLine } from 'melody'
import { blend, countSyllables, humanize, record } from 'vocals'
import type { Iteration } from './compose.js'

export type SungLine = {
  part: 'verse' | 'chorus'
  /** Which line of its part, from 0. */
  index: number
  lyrics: string
  /** The recording, where the UI can fetch it. */
  file: string
  /** Every recording made for this line: each voice's take, and their blend. */
  recordings: string[]
  /** How long the line lasts, rest included. */
  seconds: number
  /** When the line begins, in seconds from the start of the iteration. */
  at: number
}

/** Where a line stands in the song and what it says. The same line in the same place is sung the same. */
export const lineKey = (part: string, index: number, lyrics: string) =>
  `${part}:${index}:${lyrics}`

export async function perform({
  iteration,
  lyrics,
  mood,
  choir,
  sung: tune,
}: Iteration): Promise<SungLine[]> {
  const takes = new Map<string, Promise<Omit<SungLine, 'at'>>>()
  const order: Promise<Omit<SungLine, 'at'>>[] = []

  const sing = async (
    part: SungLine['part'],
    index: number,
    line: string,
  ): Promise<Omit<SungLine, 'at'>> => {
    const syllables = await countSyllables(line)
    const voices = part === 'chorus' ? choir : choir.slice(0, 1)
    const sung = await Promise.all(
      voices.map(async (voice, v) => {
        const score = setLine({
          part,
          line: index,
          lyrics: line,
          syllables,
          singer: voice.body,
          character: mood.character,
          harmony: voice.harmony,
          tune,
        })
        const take = humanize(
          score,
          `${iteration}:${lineKey(part, index, line)}:${v}`,
        )
        return {
          file: await record(take, voice.body),
          gain: voice.gain,
          seconds: scoreSeconds(score),
        }
      }),
    )
    const file = await blend(sung)
    const recordings = [...new Set([...sung.map((s) => s.file), file])]
    return {
      part,
      index,
      lyrics: line,
      file,
      recordings,
      seconds: sung[0].seconds,
    }
  }

  for (const { type: part, content } of arrange(lyrics)) {
    for (const [index, line] of content.split('\n').entries()) {
      if (!line.trim()) continue
      const key = lineKey(part, index, line)
      if (!takes.has(key)) takes.set(key, sing(part, index, line))
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
