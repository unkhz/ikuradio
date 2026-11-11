// Writing a Song down as its Session: every iteration laid end to end, every
// line at its moment with its typing decided, every Recording at its place.

import { arrange } from 'song'
import { introduce, type Placed } from 'vocals'
import { sessionVersion, type Session, type SessionIteration } from 'archive'
import type { Iteration } from './compose.js'
import type { SungLine } from './perform.js'
import { typingMoments } from './typing.js'

/** One iteration as the Studio made it: composed, sung, and with its beds. */
export type Made = {
  composed: Iteration
  lines: SungLine[]
  beds: Placed[]
}

const seconds = (n: number) => Math.round(n * 1000) / 1000

/** How long an iteration lasts: until its last line has had its place. */
export function lengthOf(lines: readonly SungLine[]) {
  return Math.max(0, ...lines.map(({ at, seconds }) => at + seconds))
}

/**
 * The Session of a Song, from its iterations as the Studio made them. Every
 * moment is counted from the Song's beginning; `name` maps a recording's
 * file to its id in the Archive.
 */
export function toSession(
  made: readonly Made[],
  name: (file: string) => string,
): Session {
  const [{ composed: first }] = made
  const { mood, choir, song } = first
  let offset = 0
  const iterations: SessionIteration[] = []
  const recordings: Session['recordings'] = []

  for (const { composed, lines, beds } of made) {
    // the performance is in the order the parts are sung, a line at a time;
    // the chorus comes twice, each time at its own moment
    let cursor = 0
    const parts = arrange(composed.lyrics).map((part) => {
      const texts = part.type === 'bridge' ? [''] : part.content.split('\n').filter((t) => t.trim())
      const placed = texts.map(() => lines[cursor++]).filter((line) => line !== undefined)
      const at = placed[0]?.at ?? 0
      const end = Math.max(at, ...placed.map((line) => line.at + line.seconds))
      return {
        type: part.type,
        at: seconds(offset + at),
        seconds: seconds(end - at),
        lines:
          part.type === 'bridge'
            ? []
            : placed.map((line, index) => ({
                text: line.lyrics,
                at: seconds(offset + line.at),
                typing: typingMoments(
                  line.lyrics,
                  line.voiced,
                  `${composed.iteration}:${part.index}:${index}`,
                ).map((moment) => Math.round(line.enters * 1000 + moment)),
              })),
      }
    })
    const length = lengthOf(lines)
    iterations.push({
      iteration: `${composed.iteration}`,
      at: seconds(offset),
      seconds: seconds(length),
      variation: composed.variation,
      of: {
        at: Number(composed.iteration - BigInt(composed.song.began)) + 1,
        of: composed.song.lasts,
      },
      parts,
    })
    for (const line of lines) {
      if (!line.file || line.unheard) continue
      recordings.push({
        id: name(line.file),
        at: seconds(offset + line.at),
        kind: 'voice',
        seconds: seconds(line.seconds),
      })
    }
    for (const bed of beds) {
      recordings.push({
        id: name(bed.file),
        at: seconds(offset + bed.at),
        gain: bed.gain,
        kind: 'bed',
      })
    }
    offset += length
  }

  return {
    version: sessionVersion,
    song: song.number,
    mood: mood.descriptions,
    mode: mood.character.mode,
    tempo: mood.character.tempo,
    ...(mood.character.sound ? { sound: mood.character.sound } : {}),
    choir: introduce(choir),
    seconds: seconds(offset),
    iterations,
    recordings,
  }
}
