// A hum with no key. The Music is an old model, and it only knows how to
// grow from a voice: told in words to be atonal, it grows anything at all,
// at any tempo, unrelated to the Song. So an atonal bridge is made where
// the Music listens, in the guide. The guide keeps the bridge's rhythm, to
// the beat, and the shape of where it rises and falls, and loses its key:
// each note takes the next pitch of a row of all twelve, the way the
// twelve-tone composers wrote, so that no pitch comes back before every
// other has been heard, and no key can settle.

import type { Score } from '../index.js'

/** The twelve pitches, as they are named. */
export const pitchNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** A row of all twelve pitches, each once, in an order drawn by `random`. */
export function toneRow(random: () => number): number[] {
  const row = Array.from({ length: 12 }, (_, pitch) => pitch)
  for (let i = row.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[row[i], row[j]] = [row[j]!, row[i]!]
  }
  return row
}

/** A row as it is read: C, F#, A, … */
export const rowName = (row: readonly number[]) => row.map((pitch) => pitchNames[pitch]).join(' ')

/**
 * The score with its key taken away: every sounding note, in order, takes
 * the next pitch of `row`, in whichever octave lies nearest the note it
 * replaces. The rhythm, the rests and the register stay as they were.
 */
export function atonal(score: Score, row: readonly number[]): Score {
  if (row.length !== 12 || new Set(row).size !== 12) throw new Error(`not a row of all twelve pitches: ${row.join(',')}`)
  let next = 0
  const notes = score.notes.map(([midi, beats]): [number, number] => {
    if (midi === 0) return [0, beats]
    const pitch = row[next++ % 12]!
    // from -6 to +5 semitones away: the nearest octave of the row's pitch
    const step = ((((pitch - midi) % 12) + 18) % 12) - 6
    return [midi + step, beats]
  })
  return { ...score, notes }
}
