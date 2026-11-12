// A bridge is music of its own, four bars that carry the song from one part
// into the next, and its work is to introduce what comes. It is not a slide
// from one note to another: two parts often end and begin on the same note,
// and a slide between them is only that note, held.
//
// So a bridge is built the way a player would build it:
//
// - a farewell: the cadence the part before ended on, said once more, in
//   that part's key;
// - a foreshadowing: the head of the part to come, its first few notes,
//   heard somewhere it never is, a fifth above or a fourth below where it
//   will begin, so the ear knows the shape before it knows the place;
// - the same head again, closer to home, half the way back;
// - a lead-in: a short climb or fall to the step just beside the coming
//   part's first note, held there, leaning, so the part that comes resolves
//   it.
//
// That is a bridge that foreshadows. There is a second kind, older, that
// walks: the last line of the part before, slowed, as an echo, and then a
// long walk, a note every second beat, through the coming key, all the way
// to the coming part's first note. When the two parts lie far apart, the
// walk is a fine thing to hear, a long climb to the chorus; when they lie on
// the same note, it has nowhere to go and is only a note held, so a bridge
// walks only where there is a distance to cover. Songs take turns: an odd
// Song walks wherever it can, an even Song foreshadows.
//
// Everything else is decided by the tune itself: the same two parts of the
// same tune always meet through the same bridge, and as the verses walk
// from Song to Song, their bridges change with them.

import { degreeToMidi, type Key } from './scale.js'
import { guideStep, slowPhrase } from './guide.js'
import type { Note, Phrase } from './fit.js'

export type BridgeForm = 'foreshadow' | 'walk'

/** Notes in MIDI, each with its length in beats. */
export type Pitches = [number, number][]

/** A phrase's notes with repeats of a degree joined: its shape, without its words. */
function contour(phrase: Phrase): Note[] {
  const notes: [number, number][] = []
  for (const [degree, beats] of phrase.notes) {
    const before = notes.at(-1)
    if (before && before[0] === degree) before[1] += beats
    else notes.push([degree, beats])
  }
  return notes
}

/** How far apart, in steps of the scale, a walk must have to go before a bridge walks it. */
export const walkingDistance = 3

/**
 * How the bridge of Song `song` from the part ending with `from` to the part
 * beginning with `to` is made: by walking, in an odd Song when the two lie
 * far enough apart, and otherwise by foreshadowing.
 */
export function bridgeForm(song: string | bigint | undefined, from: Phrase, to: Phrase): BridgeForm {
  if (song === undefined || BigInt(song) % 2n === 0n) return 'foreshadow'
  const leaving = from.notes.at(-1)?.[0] ?? 0
  const arrival = to.notes[0]?.[0] ?? 0
  return Math.abs(arrival - leaving) >= walkingDistance ? 'walk' : 'foreshadow'
}

/** The tones of a key, low to high, across the voice's reach. */
function tonesOf(key: Key): number[] {
  const tones: number[] = []
  for (let degree = -14; degree <= 21; degree++) tones.push(degreeToMidi(degree, key))
  return tones
}

/** The place in `tones` closest to `midi`. */
const nearest = (tones: number[], midi: number) =>
  tones.reduce((best, tone, i) => (Math.abs(tone - midi) < Math.abs(tones[best]! - midi) ? i : best), 0)

/**
 * The walking bridge: the first half an echo of the ending, slowed, in its
 * key; the second a walk through the coming key, a note every `step` beats,
 * arriving on the coming part's first note.
 */
function walk(from: Phrase, fromKey: Key, to: Phrase, toKey: Key, beats: number, harmony: number, step: number): Pitches {
  const half = beats / 2
  const echo: Pitches = slowPhrase(from, half, step).map(([degree, b]) => [degreeToMidi(degree + harmony, fromKey), b])
  const arrival = degreeToMidi((to.notes[0]?.[0] ?? 0) + harmony, toKey)
  const tones = tonesOf(toKey)
  const start = nearest(tones, echo.at(-1)?.[0] ?? arrival)
  const end = nearest(tones, arrival)
  const steps = Math.max(1, Math.round((beats - half) / step))
  const walked: Pitches = Array.from({ length: steps }, (_, k) => [
    tones[Math.round(start + ((end - start) * (k + 1)) / steps)]!,
    (beats - half) / steps,
  ])
  return [...echo, ...walked]
}

/** Lengths in beats, in the given proportions, in halves of a beat, filling `bar` exactly. */
function inTime(lengths: number[], bar: number): number[] {
  const total = lengths.reduce((sum, b) => sum + b, 0)
  const even = lengths.map(() => bar / lengths.length)
  if (total <= 0) return even
  const shaped = lengths.slice(0, -1).map((b) => Math.max(0.5, Math.round((b * bar) / total / 0.5) * 0.5))
  const last = bar - shaped.reduce((sum, b) => sum + b, 0)
  return last >= 0.5 ? [...shaped, last] : even
}

// where a voice is comfortable humming, in degrees around its tonic
const lowest = -5
const highest = 9

/** Degrees moved by octaves until all of them lie where a voice can hum them. */
function within(degrees: number[]): number[] {
  let moved = degrees
  while (Math.max(...moved) > highest && Math.min(...moved) - 7 >= lowest) moved = moved.map((d) => d - 7)
  while (Math.min(...moved) < lowest && Math.max(...moved) + 7 <= highest) moved = moved.map((d) => d + 7)
  return moved
}

/**
 * The notes of a bridge of `beats` beats from a part whose last line is
 * `from`, in `fromKey`, to a part whose first line is `to`, in `toKey`.
 * Foreshadowing: a farewell, the coming head heard twice, and a lead-in
 * leaning on the coming part's first note. Walking: an echo, and the long
 * walk to that note. The same note twice in a row is one.
 */
export function journey({
  from,
  fromKey,
  to,
  toKey,
  beats,
  harmony = 0,
  form = 'foreshadow',
  step = guideStep,
}: {
  from: Phrase
  fromKey: Key
  to: Phrase
  toKey: Key
  beats: number
  harmony?: number
  form?: BridgeForm
  step?: number
}): Pitches {
  return joined(
    form === 'walk' ? walk(from, fromKey, to, toKey, beats, harmony, step) : foreshadow(from, fromKey, to, toKey, beats, harmony),
  )
}

function joined(phrased: Pitches): Pitches {
  const notes: Pitches = []
  for (const [midi, b] of phrased) {
    const before = notes.at(-1)
    if (before && before[0] === midi) before[1] += b
    else notes.push([midi, b])
  }
  return notes
}

function foreshadow(from: Phrase, fromKey: Key, to: Phrase, toKey: Key, beats: number, harmony: number): Pitches {
  const bar = beats / 4
  const leaving = contour(from)
  const coming = contour(to)
  const arrival = coming[0]?.[0] ?? 0

  // the farewell: the last three notes the part before ended on
  const cadence = leaving.slice(-3).map(([degree]) => degree)
  const farewell = cadence.length > 0 ? cadence : [0]
  const farewellTimes = inTime(farewell.length === 3 ? [1, 1, 2] : farewell.map(() => 1), bar)

  // the head of the coming part, its first four notes, in their own rhythm
  const head = coming.slice(0, 4)
  const headTimes = inTime(
    head.map(([, b]) => b),
    bar,
  )
  // a head that begins high is foreshadowed a fourth below, one that begins
  // low a fifth above: always somewhere it is not
  const away = arrival >= 3 ? -3 : 4
  const nearer = Math.round(away / 2)
  const first = within(head.map(([degree]) => degree + away))
  const second = within(head.map(([degree]) => degree + nearer))

  // the lead-in comes from the side the second head left off on, and stops
  // a step short of the arrival, leaning into it
  const side = (second.at(-1) ?? arrival) < arrival ? -1 : 1
  const leadIn = [arrival + 4 * side, arrival + 2 * side, arrival + side]
  const leadInTimes = inTime([1, 1, 2], bar)

  const out = (degree: number, key: Key) => degreeToMidi(degree + harmony, key)
  return [
    ...farewell.map((degree, i): [number, number] => [out(degree, fromKey), farewellTimes[i]!]),
    ...first.map((degree, i): [number, number] => [out(degree, toKey), headTimes[i]!]),
    ...second.map((degree, i): [number, number] => [out(degree, toKey), headTimes[i]!]),
    ...leadIn.map((degree, i): [number, number] => [out(degree, toKey), leadInTimes[i]!]),
  ]
}
