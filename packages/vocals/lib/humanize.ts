// A machine that sings the same score the same way twice is a recording,
// not a singer. Humanization is the small wrongness that makes it a voice:
// a pitch a few cents off, a note held a moment too long and the next one
// taken a moment early, a vibrato that is wider on a tired day.
//
// It is small. Nothing here moves a note far enough to change the tune,
// and nothing moves the bar lines: what one note takes, its neighbour gives.
//
// It is not random. The same take, named the same way, is always the same,
// so a line can be sung again from memory. Only a new name, a new
// iteration, a new place in the song, gives a new take.

import { createHash } from 'node:crypto'
import type { Score } from 'melody'

/** A source of small wrongness: a number in [0, 1) that is always the same for the same name. */
export function wrongness(name: string): () => number {
  // mulberry32, seeded from the name
  let state = createHash('sha256').update(name).digest().readUInt32LE(0)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A number between `low` and `high`. */
const between = (random: () => number, low: number, high: number) =>
  low + (high - low) * random()

/** At most this many cents away from true, for the whole take. */
const drift = 8
/** At most this many cents away from the take's drift, for any one note. */
const wobble = 5
/** At most this share of a note's length is given to its neighbour. */
const lean = 0.12

export type Take = Score & {
  /** Seconds of breath before the first note. */
  t0: number
  /** Vibrato depth in cents on held vowels. */
  vibrato: number
}

/** One human take of a score. `name` decides which wrongness it gets. */
export function humanize(score: Score, name: string): Take {
  const random = wrongness(name)
  const takeDrift = between(random, -drift, drift)
  const notes = score.notes.map(([midi, beats]): [number, number] => [
    midi > 0
      ? midi + (takeDrift + between(random, -wobble, wobble)) / 100
      : midi,
    beats,
  ])

  // lean: one sung note borrows a little time from the next, and the bar stays whole
  for (let i = 0; i + 1 < notes.length; i++) {
    if (notes[i][0] <= 0 || notes[i + 1][0] <= 0) continue
    const shorter = Math.min(notes[i][1], notes[i + 1][1])
    const shift = between(random, -lean, lean) * shorter
    notes[i][1] += shift
    notes[i + 1][1] -= shift
  }

  return {
    ...score,
    notes,
    t0: between(random, 0.24, 0.36),
    vibrato: between(random, 22, 48),
  }
}
