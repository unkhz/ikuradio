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

import { wrongness, type Score } from 'melody'

export { wrongness }

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
} & Partial<Throat>

/**
 * A throat of one's own: how hard a singer breathes, how tightly their folds
 * close, and how much air escapes between them. Missing, the throat sings as
 * Chimera does by default: 9, 0.55 and 0.15.
 */
export type Throat = {
  /** Lung pressure, in cmH2O. */
  pressure: number
  /** 0 slack … 1 pressed. */
  tension: number
  /** 0 clear … 1 all breath. */
  breathiness: number
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
