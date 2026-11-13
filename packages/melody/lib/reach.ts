// How far a voice can reach.
//
// A throat will sing any note it is given, but not every note is still a
// voice. Each body was sung up and down, one held note at a time, and
// listened to by its overtones: where they fall to almost nothing beside
// the fundamental, or the sound slips off the note into rumble, it is no
// longer a voice. The female throat stays one from the G sharp below the
// bass staff to the D sharp an octave and a half above middle C; the man's
// from the F sharp to the C sharp; the child's from the B to the A above
// the treble staff. Whatever is chosen for a voice is chosen within these.

import type { Singer } from '../index.js'
import { degreeToMidi, type Key } from './scale.js'

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
