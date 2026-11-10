// The clock of the song.
//
// Everything happens at a moment, not after a delay. An iteration begins at
// a moment on the clock, and every line begins exactly where the music puts
// it: so many seconds after the iteration began, never "a little after the
// line before it finished". Every character of a line is typed at its own
// moment within the time the line is sung. A timer that wakes late makes
// one character late, never the ones after it.
//
// If the next iteration is not ready when the last one ends, the song holds
// its breath, a fermata, for as long as it has to, and then takes up the
// beat again from that moment. It never hurries to catch up.

import { wrongness } from 'melody'
import type { SongPart } from 'song'

export type IterationEvent = {
  type: 'iteration'
  /** Counts from one: the first iteration ever sung is iteration one. */
  content: bigint
}

export type PartEvent = {
  type: 'part'
  content: 'verse' | 'chorus'
}

export type LineEvent = {
  type: 'line'
  content: string
  part: SongPart['type']
  /** Which line of the part, from 0. */
  index: number
}

export type CharEvent = {
  type: 'char'
  content: string
}

/** The song waited for its next iteration this many seconds longer than the music allowed. */
export type FermataEvent = {
  type: 'fermata'
  content: number
}

export type SingEvent =
  IterationEvent | PartEvent | LineEvent | CharEvent | FermataEvent

/** How long a line lasts in the music, and how much of that it is sung. */
export type LineTiming = {
  /** The line's whole place in the music, rest included. */
  seconds: number
  /** When the voice begins, from the start of the line. */
  enters: number
  /** How long the voice sings. */
  voiced: number
}

/** A part of the song, with the timing of every line in it. Unsung lines last no time at all. */
export type TimedPart = SongPart & { timing: readonly LineTiming[] }

/** Something that knows the time and can wait for a moment, in milliseconds. */
export type Clock = {
  now(): number
  until(moment: number): Promise<void>
}

export const wallClock: Clock = {
  now: () => performance.now(),
  async until(moment) {
    // timers may wake early or late; never act early
    for (let left = moment - performance.now(); left > 0;) {
      await new Promise((resolve) => setTimeout(resolve, left))
      left = moment - performance.now()
    }
  },
}

/** A late iteration is only a fermata if it is later than this, in milliseconds. */
const tolerance = 50

/**
 * When each character of a line is typed, in milliseconds from when the
 * voice enters. A comma is followed by a breath nine characters long, and
 * the line ends with a breath of ten. Each moment wavers a little, but
 * never so much that a character overtakes its neighbour.
 */
export function typingMoments(
  line: string,
  voiced: number,
  name: string,
): number[] {
  const weights = [...line].map((char) => (char === ',' ? 10 : 1))
  const whole = weights.reduce((sum, w) => sum + w, 0) + 10
  const random = wrongness(`typing:${name}`)
  const moments: number[] = []
  let before = 0
  for (const weight of weights) {
    const gap = (voiced * 1000) / whole
    const moment = before + gap * (1 + 0.4 * (random() - 0.5))
    moments.push(moment)
    before += gap * weight
  }
  // the line break comes after the last breath
  moments.push(voiced * 1000)
  return moments
}

// After decillion iterations, start over again. What else can you do?
// According to Wikipedia (https://en.wikipedia.org/wiki/Names_of_large_numbers),
// numbers after decillion are not widely standardized, so it's perhaps the
// best time to start over.
const loopLength = 1_000_000_000_000_000_000_000_000_000_000_000_000_000_000n

export async function* sing(
  song: (iteration: bigint) => Promise<TimedPart[]>,
  /** Where to begin: 0 for the first time, later after a sleep. */
  from = 0n,
  clock: Clock = wallClock,
): AsyncGenerator<SingEvent> {
  let iteration = from
  let next = song(iteration)
  /** The moment the next iteration is due to begin. */
  let due: number | undefined

  while (true) {
    const parts = await next
    const now = clock.now()
    if (due === undefined || now - due > tolerance) {
      if (due !== undefined) {
        yield { type: 'fermata', content: (now - due) / 1000 }
      }
      due = now
    }
    const begins = due
    const name = `${iteration}`
    iteration++
    next = song(iteration)
    yield { type: 'iteration', content: iteration }

    let at = begins
    for (const part of parts) {
      yield { type: 'part', content: part.type }
      const lines = part.content.split('\n')
      for (const [index, line] of lines.entries()) {
        const timing = part.timing[index] ?? {
          seconds: 0,
          enters: 0,
          voiced: 0,
        }
        await clock.until(at)
        yield { type: 'line', content: line, part: part.type, index }
        if (line.trim()) {
          const voice = at + timing.enters * 1000
          const moments = typingMoments(
            line,
            timing.voiced,
            `${name}:${part.index}:${index}`,
          )
          for (const [c, moment] of moments.entries()) {
            await clock.until(voice + moment)
            yield { type: 'char', content: c < line.length ? line[c] : '\n' }
          }
        }
        at += timing.seconds * 1000
      }
      // a blank line between parts, at once
      yield { type: 'char', content: '\n' }
    }
    due = at

    if (iteration === loopLength) {
      iteration = 0n
    }
  }
}
