// The guide: a part's melody slowed to its skeleton, for the Music to follow.
//
// The Music listens to the shape of the pitches and grows its bed after
// them. A sung line moves too fast for it: eighth notes come and go, and
// the Music chases each one and loses the line. So the lead also hums a
// guide, for the Music alone: the note sounding on every second beat, held
// until the next, the same notes merged into one, the breaths between lines
// held through. The tune is still there, slowly, like a bass player's
// reading of a melody.

import type { Note, Phrase } from './fit.js'

/** How often the guide moves, at most, in beats. */
export const guideStep = 2

/**
 * A phrase slowed to its skeleton, lasting `beats` beats: the degree
 * sounding at every `step` beats, held, the rest bridged by holding the last
 * note through it. The same degree twice in a row is one note.
 */
export function slowPhrase(phrase: Phrase, beats: number, step = guideStep): Note[] {
  const length = phrase.notes.reduce((sum, [, b]) => sum + b, 0) + phrase.rest
  // the phrase as it is written, stretched or squeezed to the line's own time
  const scale = length > 0 ? beats / length : 1
  const sounding = (t: number) => {
    let at = 0
    let last = phrase.notes[0]?.[0] ?? 0
    for (const [degree, b] of phrase.notes) {
      if (t < at + b * scale) return degree
      at += b * scale
      last = degree
    }
    return last
  }
  const slow: [number, number][] = []
  for (let t = 0; t < beats - 1e-9; t += step) {
    const held = Math.min(step, beats - t)
    const degree = sounding(t)
    const before = slow.at(-1)
    if (before && before[0] === degree) before[1] += held
    else slow.push([degree, held])
  }
  return slow
}

/**
 * The guide for a section of lines, each line's phrase slowed and laid end
 * to end, each lasting as many beats as its line does. Notes that meet at a
 * line's edge on the same degree are joined.
 */
export function slowSection(lines: { phrase: Phrase; beats: number }[], step = guideStep): Note[] {
  const notes: [number, number][] = []
  for (const { phrase, beats } of lines) {
    for (const [degree, b] of slowPhrase(phrase, beats, step)) {
      const before = notes.at(-1)
      if (before && before[0] === degree) before[1] += b
      else notes.push([degree, b])
    }
  }
  return notes
}
