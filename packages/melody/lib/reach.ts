// How far a voice can reach, and how far a tune may leap.
//
// A throat will sing any note it is given, but not every note is still a
// voice. Each body was sung up and down, one held note at a time, and
// listened to by its overtones: where they fall to almost nothing beside
// the fundamental, or the sound slips off the note into rumble, it is no
// longer a voice. The female throat stays one from the G sharp below the
// bass staff to the D sharp an octave and a half above middle C; the man's
// from the F sharp to the C sharp; the child's from the B to the A above
// the treble staff. Whatever is chosen for a voice is chosen within these.
//
// And a tune may leap. Heard from a Perspective that wants it drastic, the
// verses and the bridges keep their rhythm, but every change of note jumps
// far, by whole tones, between a least and a most drawn for the Song, up or
// down as the voice has room to: near the top it leaps down, near the
// bottom up. The leaps land on notes of the key, so the choir and the band
// still have one to share.

import type { Singer } from '../index.js'
import type { Phrase } from './fit.js'
import { degreeToMidi, type Key } from './scale.js'
import type { Tune } from './variation.js'

/** The notes each body still sings as a voice, lowest and highest, by its overtones. */
export const vocalRange: Record<Singer, readonly [low: number, high: number]> = {
  male: [42, 73],
  female: [44, 75],
  child: [47, 81],
}

/** The scale degree a note of `key` is, or undefined for a note outside it, and for silence. */
export function degreeOf(midi: number, key: Key): number | undefined {
  if (midi === 0) return undefined
  for (let degree = -35; degree <= 42; degree++) if (degreeToMidi(degree, key) === midi) return degree
  return undefined
}

/** The degree of the note of `key` nearest to `midi`, the lower one where two are as near. */
export function nearestDegree(midi: number, key: Key): number {
  let best = 0
  for (let degree = -35; degree <= 42; degree++) {
    if (Math.abs(degreeToMidi(degree, key) - midi) < Math.abs(degreeToMidi(best, key) - midi)) best = degree
  }
  return best
}

/** How far a drastic tune leaps, in whole tones: at least `least`, at most `most`. */
export type Leap = readonly [least: number, most: number]

/**
 * Degrees of `key` made to leap: the first stays, brought into `range` an
 * octave at a time if it lies outside; a note that repeats the one before
 * repeats it still; every other change jumps between `least` and `most`
 * whole tones to a note of the key, in its own direction if there is room
 * there, the other way if not, and as far as there is room where neither
 * way has any.
 */
export function leaping(
  degrees: readonly number[],
  key: Key,
  [least, most]: Leap,
  random: () => number,
  [low, high]: readonly [number, number],
): number[] {
  const steps = key.mode.length
  const pitch = (degree: number) => degreeToMidi(degree, key)
  const out: number[] = []
  for (const [i, degree] of degrees.entries()) {
    const was = out.at(-1)
    if (i === 0 || was === undefined) {
      let first = degree
      while (pitch(first) < low && pitch(first + steps) <= high) first += steps
      while (pitch(first) > high && pitch(first - steps) >= low) first -= steps
      out.push(first)
      continue
    }
    const change = degree - degrees[i - 1]!
    if (change === 0) {
      out.push(was)
      continue
    }
    const way = Math.sign(change)
    const near = (d: number) => pitch(d) >= low && pitch(d) <= high && d !== was
    const far = (d: number) => Math.abs(pitch(d) - pitch(was)) / 2
    const reachable: number[] = []
    for (let d = was - 3 * steps; d <= was + 3 * steps; d++) if (near(d)) reachable.push(d)
    const leaps = (side: number) =>
      reachable.filter((d) => Math.sign(d - was) === side && far(d) >= least && far(d) <= most)
    const choices = leaps(way).length ? leaps(way) : leaps(-way)
    if (choices.length) {
      out.push(choices[Math.floor(random() * choices.length)]!)
      continue
    }
    // nowhere far enough to leap to: as far as the voice can reach, either way
    out.push(reachable.reduce((best, d) => (far(d) > far(best) ? d : best), reachable[0] ?? was))
  }
  return out
}

/** A phrase made to leap, in `key` and within `range`: its rhythm as it was, its notes leaping. */
export function leapPhrase(phrase: Phrase, key: Key, leap: Leap, random: () => number, range: readonly [number, number]): Phrase {
  const degrees = leaping(
    phrase.notes.map(([degree]) => degree),
    key,
    leap,
    random,
    range,
  )
  return { ...phrase, notes: phrase.notes.map(([, beats], i) => [degrees[i]!, beats] as const) }
}

/** The tune with its verses made to leap, for a lead in `key` within `range`. The chorus is the anchor, and is not touched. */
export function leapTune(tune: Tune, key: Key, leap: Leap, random: () => number, range: readonly [number, number]): Tune {
  return { ...tune, verse: tune.verse.map((phrase) => leapPhrase(phrase, key, leap, random, range)) }
}

/** A lead's score made to leap, in `key` within `range`: its rests and its rhythm as they were. */
export function leapScore<S extends { notes: [number, number][] }>(
  score: S,
  key: Key,
  leap: Leap,
  random: () => number,
  range: readonly [number, number],
): S {
  const sounding = score.notes.filter(([midi]) => midi !== 0).map(([midi]) => nearestDegree(midi, key))
  const leapt = leaping(sounding, key, leap, random, range)
  let next = 0
  const notes = score.notes.map(([midi, beats]): [number, number] =>
    midi === 0 ? [0, beats] : [degreeToMidi(leapt[next++]!, key), beats],
  )
  return { ...score, notes }
}
