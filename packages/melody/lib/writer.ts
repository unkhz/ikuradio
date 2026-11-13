// The melody writer: a verse the song has never sung.
//
// Heard from a Perspective that wants it unfamiliar, a Song sings its verse
// to a melody written for it alone, and forgets it again: the tune it
// remembers, and passes on, is the one it had. The new melody keeps the
// verse's rhythm, every bar line and every note's length, so the words fall
// as they always do. Only its pitches are new.
//
// It is written the way a plain tune is written, and it shares its rules
// with the harmonizer: the key and the mode, the voice's range, the cost of
// motion. Its four lines are a question and an answer, twice: the first
// rises and stops open, on the fifth or the second; the second answers,
// coming down; the third asks again, higher, to the highest note of the
// verse; the fourth comes home, to the tonic, so the chorus arrives as it
// always has. It moves mostly by step. Where it leaps, it turns back. Each
// line ends on a cadence, approached by step. Written by the Song's own
// wrongness, the same Song always writes the same verse.

import type { Phrase } from './fit.js'
import { degreeToMidi, type Key } from './scale.js'

/** What a line of the verse is asked to do: where it begins, how high it climbs, where it may end. */
type Shape = { start?: readonly number[]; peak: readonly number[]; ends: readonly number[] }

/** A question, an answer, the question again at its highest, and home. */
const question: Shape = { start: [0, 2], peak: [3, 4], ends: [4, 1] }
const answer: Shape = { peak: [2, 3], ends: [0, 2] }
const higher: Shape = { peak: [5, 6, 7], ends: [4] }
const home: Shape = { peak: [2, 3, 4], ends: [0] }

/** How a move costs, by how far it goes in scale steps: a step is the cheapest, a repeat a little dull, a leap dear. */
const motion = (steps: number) => [0.7, 0, 0.3, 1, 1.6, 2.4][steps] ?? 3 + steps

const pick = <T>(choices: readonly T[], random: () => number) => choices[Math.floor(random() * choices.length)]!

/**
 * One line, its pitches written anew: `notes` its own lengths, `was` the
 * degrees it had, which it would rather not sing again, `from` the note the
 * line before ended on, `shape` what the line is asked to do, `low` and
 * `high` the degrees it may use, `key` how its steps sound.
 */
function writeLine({
  was,
  from,
  shape,
  low,
  high,
  key,
  random,
}: {
  was: readonly number[]
  from: number | undefined
  shape: Shape
  low: number
  high: number
  key: Key
  random: () => number
}): number[] {
  const count = was.length
  const start = shape.start ? pick(shape.start, random) : (from ?? 0)
  const peak = Math.min(high, pick(shape.peak, random))
  const end = pick(shape.ends, random)
  const summit = Math.max(1, Math.min(count - 2, Math.round((count - 1) * (0.45 + 0.25 * random()))))
  // the line's contour: up to its peak, and down to its end
  const aim = Array.from({ length: count }, (_, i) =>
    i <= summit ? start + ((peak - start) * i) / summit : peak + ((end - peak) * (i - summit)) / Math.max(1, count - 1 - summit),
  )
  const degrees = Array.from({ length: high - low + 1 }, (_, k) => low + k)
  const choices = (i: number) => (i === count - 1 ? [end] : degrees)
  const node = (i: number, d: number) =>
    0.5 * Math.abs(d - aim[i]!) +
    (i === summit ? 1.5 * Math.abs(d - peak) : 0) +
    (d === was[i] ? 0.6 : 0) +
    (i === count - 2 && Math.abs(d - end) > 2 ? 3 : 0)
  const semitones = (a: number, b: number) => Math.abs(degreeToMidi(a, key) - degreeToMidi(b, key))
  const move = (a: number | undefined, b: number, c: number) => {
    let cost = motion(Math.abs(c - b))
    if (semitones(b, c) === 6) cost += 3
    // a line that only rocks between two neighbours goes nowhere
    if (a !== undefined && c === a && Math.abs(b - a) <= 1) cost += 0.8
    if (a !== undefined && Math.abs(b - a) >= 3) {
      // after a leap, turn back
      cost += Math.sign(c - b) === Math.sign(b - a) ? 2.5 : Math.abs(c - b) <= 2 ? -0.3 : 0
    }
    return cost
  }
  // the cheapest line, remembering the last two notes, so a leap knows to turn back
  type State = { cost: number; path: number[] }
  let states = new Map<string, State>()
  for (const d of choices(0)) {
    const enter = from === undefined ? 0 : 0.5 * motion(Math.abs(d - from))
    states.set(`${d}`, { cost: node(0, d) + enter + random() * 0.3, path: [d] })
  }
  for (let i = 1; i < count; i++) {
    const next = new Map<string, State>()
    for (const { cost, path } of states.values()) {
      const [a, b] = [path.at(-2), path.at(-1)!]
      for (const c of choices(i)) {
        const total = cost + move(a, b, c) + node(i, c) + random() * 0.3
        const key = `${b},${c}`
        if (!next.has(key) || next.get(key)!.cost > total) next.set(key, { cost: total, path: [...path, c] })
      }
    }
    states = next
  }
  return [...states.values()].reduce((best, s) => (s.cost < best.cost ? s : best)).path
}

/**
 * The verse written anew, for one Song: every line to its own rhythm and
 * rest, with new pitches, for a lead singing in `key` within `range` (the
 * notes its body can sing). The verse it was written from is not changed.
 */
export function unfamiliarVerse(
  verse: readonly Phrase[],
  { key, range: [lowest, highest], random }: { key: Key; range: readonly [number, number]; random: () => number },
): Phrase[] {
  // the degrees the voice can sing, within the compass a verse keeps
  const inRange = Array.from({ length: 15 }, (_, k) => k - 5).filter((d) => {
    const midi = degreeToMidi(d, key)
    return midi >= lowest && midi <= highest
  })
  const low = inRange[0] ?? -5
  const high = inRange.at(-1) ?? 9
  const shapes = verse.map((_, k) => (k === verse.length - 1 ? home : [question, answer, higher][k % 3]!))
  // the third line's summit is the verse's highest note; the others stay beneath it
  const summit = Math.min(high, pick(higher.peak, random))
  let from: number | undefined
  return verse.map((phrase, k) => {
    const shape = shapes[k] === higher ? { ...higher, peak: [summit] } : shapes[k]!
    const written = writeLine({
      was: phrase.notes.map(([degree]) => degree),
      from,
      shape,
      low,
      high: shapes[k] === higher ? high : Math.min(high, summit - 1),
      key,
      random,
    })
    from = written.at(-1)
    return { ...phrase, notes: phrase.notes.map(([, beats], i) => [written[i]!, beats] as const) }
  })
}
