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
import type { TimedSyllable, TwoVoiceGuide } from './guide.js'
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

// The writer over the guide: every line, every iteration (plans "A melody
// for every iteration" and "The two-voice guide").
//
// The words' rhythm is already laid in their bars; the guide has already
// said where the harmony goes. What is left is to choose a pitch for every
// syllable, and the writer reads the rhythm to do it. A stressed syllable
// on a strong beat, or a long one, is where the melody stands: on a tone of
// the guide's chord, best on the upper voice's note or a third or a sixth
// from it, and only there may it leap. The quick light syllables between
// move by step, passing from one standing point to the next. A comma or the
// line's end is a breath, and the melody settles there, on the chord's root
// or its third; at the end of a section, on the guide's own cadence note.
// The highest note goes to the line's weightiest word. After a leap the
// line turns back, and more than three syllables on one pitch grow duller
// with every one. Against the guide's lower voice it moves as a second
// voice must: no fifths or octaves in parallel across a change of chord.
//
// Among the lines that keep these rules it does not take the cheapest, but
// samples, the cheaper the likelier, as a singer who knows the rules does
// not sing the same line twice. `sprinkle` is how far it roams: at 0 it
// always takes the cheapest. Last iteration's line, given, pulls gently on
// its contour, so a line drifts instead of jumping.


/** What the writer weighs, in one place, so a tweak is one number. */
export const writerCosts = {
  /** A standing point off the chord. */
  standingOff: 3,
  /** A standing point on the chord, but neither on the upper voice's note nor a third or sixth from it. */
  standingLoose: 0.6,
  /** A quick syllable off the chord: a passing or neighbour note, cheap when it is reached and left by step. */
  passing: 0.4,
  /** A note off the chord reached or left by a leap. */
  unprepared: 1.5,
  /** A breath on the chord's fifth rather than its root or third. */
  breathFifth: 1.2,
  /** A breath off the chord. */
  breathOff: 4,
  /** A section's last syllable on anything but the guide's cadence note. */
  cadence: 6,
  /** Motion by scale steps: a repeat, a step, a third, a fourth, a fifth, a sixth, an octave. */
  motion: [0.3, 0, 0.7, 1.3, 1.9, 2.6, 3] as readonly number[],
  /** A tritone leap. */
  tritone: 3,
  /** A leap of a fourth or more onto a quick light syllable, rather than a standing point. */
  leapLight: 1,
  /** Going on the same way after a leap of a fourth or more. */
  afterLeap: 2.5,
  /** Turning back by step after a leap: a gain. */
  turnBack: -0.3,
  /** Every syllable past the third in a row on one pitch. */
  sameAgain: 1.2,
  /** A fifth or an octave against the lower voice, after one, across a change of chord. */
  parallel: 4,
  /** How far below the top of its compass the line's weightiest word may stand before it costs, per step. */
  summit: 0.5,
  /** How far from the middle of its compass a note lies, per step. */
  middle: 0.08,
  /** Going against the contour last iteration's line took, scaled by the guide setting. */
  contour: 0.5,
  /** How sharply the sampling prefers the cheaper line, at a sprinkle of one. */
  temperature: 0.8,
}

/** Where the melody stands: a stressed syllable on a strong beat, or a long one. */
export const standing = (s: TimedSyllable) => (s.stress === 1 && s.at % 2 === 0) || s.beats >= 1
const breath = (s: TimedSyllable) => s.comma || s.lineEnd

/** The guide's chord, and the upper voice's note, sounding at a moment. */
function guideAt(guide: TwoVoiceGuide, at: number) {
  const chord = guide.chords.findLast((c) => c.at <= at + 1e-9) ?? guide.chords[0]!
  let t = 0
  let upper = chord.upper
  for (const [degree, beats] of guide.upper) {
    if (t > at + 1e-9) break
    upper = degree
    t += beats
  }
  return { chord, upper }
}

const cls = (d: number) => ((d % 7) + 7) % 7

/**
 * The pitches of one sung line over its section's guide, in degrees of the
 * guide's frame, one a syllable. `syllables` are the line's own, timed from
 * the section's start; `low` and `high` the degrees the voice may use;
 * `from` the degree the line before ended on; `closes` whether the section
 * ends with this line; `previous` the degrees the line had last iteration.
 * `semitones` tells how far apart two degrees sound, for the tritone and the
 * perfect intervals against the lower voice.
 */
export function writeOverGuide({
  syllables,
  guide,
  low,
  high,
  random,
  semitones,
  from,
  closes = false,
  previous,
  sprinkle = 1,
  pull = 1,
}: {
  syllables: readonly TimedSyllable[]
  guide: TwoVoiceGuide
  low: number
  high: number
  random: () => number
  semitones: (a: number, b: number) => number
  from?: number
  closes?: boolean
  previous?: readonly number[]
  sprinkle?: number
  pull?: number
}): number[] {
  const n = syllables.length
  if (n === 0) return []
  const c = writerCosts
  const degrees = Array.from({ length: high - low + 1 }, (_, k) => low + k)
  const middle = (low + high) / 2
  const at = syllables.map((s) => guideAt(guide, s.at))
  const finalUpper = guide.upper.at(-1)![0]
  // the weightiest word: the longest stressed syllable, the later where two are as long
  const summit = syllables.reduce((best, s, i) => (s.stress === 1 && (best < 0 || s.beats >= syllables[best]!.beats) ? i : best), -1)
  const chordTone = (i: number, d: number) => [0, 2, 4].includes(cls(d - at[i]!.chord.root))
  const node = (i: number, d: number) => {
    const s = syllables[i]!
    const { chord, upper } = at[i]!
    const tone = chordTone(i, d)
    let cost = c.middle * Math.abs(d - middle)
    if (standing(s)) {
      if (!tone) cost += c.standingOff
      else if (![0, 2, 5].includes(Math.abs(d - upper) % 7)) cost += c.standingLoose
    } else if (!tone) cost += c.passing
    if (breath(s)) {
      const step = cls(d - chord.root)
      cost += step === 4 ? c.breathFifth : step === 0 || step === 2 ? 0 : c.breathOff
    }
    if (closes && i === n - 1 && cls(d) !== cls(finalUpper)) cost += c.cadence
    if (i === summit) cost += c.summit * Math.max(0, high - 2 - d)
    return cost
  }
  const move = (i: number, a: number | undefined, b: number, d: number) => {
    const steps = Math.abs(d - b)
    let cost = c.motion[steps] ?? 3 + steps
    if (semitones(b, d) % 12 === 6) cost += c.tritone
    if (steps >= 3 && !standing(syllables[i]!)) cost += c.leapLight
    // a note off the chord is reached and left by step
    if (steps > 1 && (!chordTone(i - 1, b) || !chordTone(i, d))) cost += c.unprepared
    if (a !== undefined && Math.abs(b - a) >= 3) {
      cost += Math.sign(d - b) === Math.sign(b - a) ? c.afterLeap : steps === 1 ? c.turnBack : 0
    }
    // across a change of chord, no fifths or octaves in parallel with the lower voice
    if (at[i]!.chord !== at[i - 1]!.chord && d !== b) {
      const perfect = (x: number, bass: number) => [0, 7].includes(semitones(bass, x) % 12)
      if (perfect(b, at[i - 1]!.chord.bass) && perfect(d, at[i]!.chord.bass)) cost += c.parallel
    }
    if (previous && previous[i] !== undefined && previous[i - 1] !== undefined) {
      if (Math.sign(d - b) !== Math.sign(previous[i]! - previous[i - 1]!)) cost += c.contour * pull
    }
    return cost
  }
  // states: the last two degrees and how many syllables in a row have sung the last one
  type State = { a: number | undefined; b: number; run: number }
  const keyOf = (s: State) => `${s.a},${s.b},${s.run}`
  const temperature = c.temperature * sprinkle
  // forward, in costs: a soft minimum when sampling, the minimum when not
  const combine = (x: number, y: number) =>
    temperature <= 0 ? Math.min(x, y) : Math.min(x, y) - temperature * Math.log1p(Math.exp(-Math.abs(x - y) / temperature))
  const layers: Map<string, { state: State; cost: number; from: Map<string, number> }>[] = []
  const first = new Map<string, { state: State; cost: number; from: Map<string, number> }>()
  for (const d of degrees) {
    const enter = from === undefined ? 0 : 0.5 * (c.motion[Math.abs(d - from)] ?? 3)
    const state = { a: undefined, b: d, run: 1 }
    first.set(keyOf(state), { state, cost: node(0, d) + enter, from: new Map() })
  }
  layers.push(first)
  for (let i = 1; i < n; i++) {
    const next = new Map<string, { state: State; cost: number; from: Map<string, number> }>()
    for (const [k, { state, cost }] of layers[i - 1]!) {
      for (const d of degrees) {
        const run = d === state.b ? Math.min(state.run + 1, 6) : 1
        const step = move(i, state.a, state.b, d) + node(i, d) + (run > 3 ? c.sameAgain * (run - 3) : 0)
        const to = { a: state.b, b: d, run }
        const tk = keyOf(to)
        const total = cost + step
        const there = next.get(tk)
        if (there) {
          there.cost = combine(there.cost, total)
          there.from.set(k, total)
        } else next.set(tk, { state: to, cost: total, from: new Map([[k, total]]) })
      }
    }
    layers.push(next)
  }
  // backward: the cheapest, or a sample, the cheaper the likelier
  const choose = (options: [string, number][]) => {
    if (temperature <= 0) return options.reduce((x, y) => (y[1] < x[1] ? y : x))[0]
    const least = Math.min(...options.map(([, v]) => v))
    const weights = options.map(([, v]) => Math.exp(-(v - least) / temperature))
    let left = random() * weights.reduce((x, y) => x + y, 0)
    for (const [j, w] of weights.entries()) if ((left -= w) <= 0) return options[j]![0]
    return options.at(-1)![0]
  }
  let k = choose([...layers[n - 1]!].map(([key, { cost }]) => [key, cost]))
  const path: number[] = []
  for (let i = n - 1; i >= 0; i--) {
    const here = layers[i]!.get(k)!
    path.unshift(here.state.b)
    if (i > 0) k = choose([...here.from])
  }
  return path
}
