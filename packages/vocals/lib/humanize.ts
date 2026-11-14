// A machine that sings the same score the same way twice is a recording,
// not a singer. Humanization is the small wrongness that makes it a voice:
// a pitch a few cents off, a note held a moment too long and the next one
// taken a moment early, a vibrato that is wider on a tired day.
//
// It is small. Nothing here moves a note far enough to change the tune,
// and nothing moves the bar lines: what one note takes, its neighbour gives.
// Nor does it ever hurry a syllable: no note is leaned so short that the
// next syllable comes sooner than the Song's rate allows. And a take that
// would still come too soon is never sung (`keepsPace`).
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

/** How far a lean may go at most, whatever a Song's humanness: a note never gives away a third of itself. */
const leanest = 0.3

/**
 * One human take of a score. `name` decides which wrongness it gets.
 * `humanness` scales how far it wanders: 1 as usual, less for a tight,
 * glassy take, more for a loose one. The vibrato moves half as much.
 * `rate`, if given, is how many syllables a second the voice may sing at
 * most: no lean makes a note shorter than that allows.
 */
export function humanize(score: Score, name: string, humanness = 1, rate?: number): Take {
  const random = wrongness(name)
  const scale = Math.max(0, humanness)
  const takeDrift = between(random, -drift * scale, drift * scale)
  const notes = score.notes.map(([midi, beats]): [number, number] => [
    midi > 0
      ? midi + (takeDrift + between(random, -wobble * scale, wobble * scale)) / 100
      : midi,
    beats,
  ])

  // lean: one sung note borrows a little time from the next, and the bar stays whole,
  // but neither is left shorter than a syllable may be
  const least = rate ? (score.bpm / 60) / rate : 0
  for (let i = 0; i + 1 < notes.length; i++) {
    if (notes[i][0] <= 0 || notes[i + 1][0] <= 0) continue
    const shorter = Math.min(notes[i][1], notes[i + 1][1])
    const leaning = Math.min(leanest, lean * scale)
    const wanted = between(random, -leaning, leaning) * shorter
    // a note gives away only what it has above the shortest a syllable may be
    const shift =
      wanted < 0 ? Math.min(0, Math.max(wanted, least - notes[i][1])) : Math.max(0, Math.min(wanted, notes[i + 1][1] - least))
    notes[i][1] += shift
    notes[i + 1][1] -= shift
  }

  return {
    ...score,
    notes,
    t0: between(random, 0.24, 0.36),
    vibrato: between(random, 22, 48) * (0.5 + 0.5 * scale),
  }
}

/** A take that would sing a syllable sooner than its Song's rate allows. It is never sung. */
export class TooFast extends Error {}

/**
 * The shortest time between the starts of two sung syllables in a take, in
 * seconds: rests between them count, as time the voice has. Infinity for a
 * take of one syllable or none.
 */
export function quickest({ bpm, notes }: Pick<Score, 'bpm' | 'notes'>): number {
  let at = 0
  let last: number | undefined
  let quickest = Infinity
  for (const [midi, beats] of notes) {
    if (midi > 0) {
      if (last !== undefined) quickest = Math.min(quickest, at - last)
      last = at
    }
    at += (beats * 60) / bpm
  }
  return quickest
}

/**
 * The backstop: throws TooFast if any syllable of `take` starts sooner than
 * 1 / `rate` seconds after the one before, so that syllable soup is never
 * sung; the iteration fails, and is made again. `what` names the take.
 */
export function keepsPace(take: Pick<Score, 'bpm' | 'notes'>, rate: number, what: string): void {
  const fastest = quickest(take)
  if (fastest < 1 / rate - 1e-6) {
    throw new TooFast(
      `${what} would sing a syllable ${(fastest * 1000).toFixed(0)} ms after the one before, sooner than ${(1000 / rate).toFixed(0)} ms (${rate} a second)`,
    )
  }
}
