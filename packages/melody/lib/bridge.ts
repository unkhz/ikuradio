// A bridge is a journey. It begins where the part before it ended, in that
// part's key: its last line, slowed, as an echo. Then it walks, a note
// every second beat, through the key of the part to come, until it arrives
// on that part's first note. The part to come then begins where the bridge
// has already led the ear.

import { degreeToMidi, type Key } from './scale.js'
import { guideStep, slowPhrase } from './guide.js'
import type { Phrase } from './fit.js'

/** Notes in MIDI, each with its length in beats. */
export type Pitches = [number, number][]

/** The tones of a key, low to high, across the voice's reach. */
function tonesOf(key: Key): number[] {
  const tones: number[] = []
  for (let degree = -14; degree <= 21; degree++) tones.push(degreeToMidi(degree, key))
  return tones
}

/** The place in `tones` closest to `midi`. */
const nearest = (tones: number[], midi: number) =>
  tones.reduce((best, tone, i) => (Math.abs(tone - midi) < Math.abs(tones[best] - midi) ? i : best), 0)

/**
 * The notes of a bridge of `beats` beats from a part that ended with `from`
 * in `fromKey` to a part that begins with `to` in `toKey`: the first half an
 * echo of the ending, slowed; the second a walk through the coming key,
 * arriving on the coming part's first note. The same note twice is one.
 */
export function journey({
  from,
  fromKey,
  to,
  toKey,
  beats,
  harmony = 0,
  step = guideStep,
}: {
  from: Phrase
  fromKey: Key
  to: Phrase
  toKey: Key
  beats: number
  harmony?: number
  step?: number
}): Pitches {
  const half = beats / 2
  const echo: Pitches = slowPhrase(from, half, step).map(([degree, b]) => [
    degreeToMidi(degree + harmony, fromKey),
    b,
  ])
  const arrival = degreeToMidi((to.notes[0]?.[0] ?? 0) + harmony, toKey)
  const tones = tonesOf(toKey)
  const leaving = echo.at(-1)?.[0] ?? arrival
  const start = nearest(tones, leaving)
  const end = nearest(tones, arrival)
  const steps = Math.max(1, Math.round((beats - half) / step))
  const walk: Pitches = Array.from({ length: steps }, (_, k) => {
    const place = Math.round(start + ((end - start) * (k + 1)) / steps)
    return [tones[place], (beats - half) / steps]
  })
  const notes: Pitches = []
  for (const [midi, b] of [...echo, ...walk]) {
    const before = notes.at(-1)
    if (before && before[0] === midi) before[1] += b
    else notes.push([midi, b])
  }
  return notes
}
