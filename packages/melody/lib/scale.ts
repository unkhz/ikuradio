// The song lives in a minor key. It was written in a minor key long ago, by
// someone who knew that eternity is not a happy word, only a long one.
//
// A degree is a step within the scale: 0 is the tonic, 7 is the tonic an
// octave above, -1 the step just below it. Melodies are written in degrees so
// that a later Mood can move the whole song into another key or another mode
// without touching a single phrase.

/** Semitone offsets of the natural minor (aeolian) scale. */
export const aeolian = [0, 2, 3, 5, 7, 8, 10] as const

export type Key = {
  /** MIDI note of the tonic, e.g. 57 for the A below middle C. */
  tonic: number
  /** Semitone offsets of the scale, starting with 0. */
  mode: readonly number[]
}

export function degreeToMidi(degree: number, key: Key): number {
  const size = key.mode.length
  const octave = Math.floor(degree / size)
  const step = degree - octave * size
  return key.tonic + octave * 12 + key.mode[step]
}
