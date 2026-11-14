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
import { degreeToMidi, type Key } from './scale.js'

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

// ---------------------------------------------------------------------------
// The two-voice guide.
//
// The guide comes first now. Before any melody, each section is given a
// harmony of its own, out of its words: where the words lean, the chord
// changes; where a line ends, or a comma falls, it breathes. It leaves
// home, travels, with its furthest point late in the section, and comes back
// with a cadence: half, on the fifth degree, into whatever follows, or
// whole, the fifth then home, at the end of a chorus or an iteration. The
// path is sampled among good ones, by the section's own wrongness, so the
// same iteration always has the same harmony, and last iteration's guide
// pulls gently, so the harmony drifts instead of jumping.
//
// It is sung by two voices: a low one that moves like a bass, roots and
// inversions, and a slow high one above it. Between them, the old rules of
// counterpoint: thirds, sixths and tenths on the changes, fifths and
// octaves at the start and the cadences, contrary motion before parallel,
// never fifths or octaves in parallel, and at the end a closing in by step.
// Every chord is written down as it is meant, root, bass, upper voice,
// length and function, so nothing after it has to guess the harmony from a
// sound.


/** One sung syllable of a section, as the bar fit placed it: when, how long, how it leans, and what follows it. */
export type TimedSyllable = {
  /** Its onset, in beats from the start of the section. */
  at: number
  /** How long it is sung, in beats. */
  beats: number
  /** 0 none, 1 main, 2 lesser. */
  stress: number
  /** Whether it begins a word. */
  begins: boolean
  /** Whether a comma, or a stop, follows it: a lighter phrase point. */
  comma: boolean
  /** Whether the line ends after it: a cadence point. */
  lineEnd: boolean
  /** In the number line, whether it begins a number's scale word, "thousand", "million": a harmonic step. */
  group?: boolean
}

/** How far a chord stands from home: home itself, away from it, or in the tension that wants to return. */
export type ChordFunction = 'home' | 'away' | 'tension'

/** A chord of the guide, as it is meant: degrees are scale steps of the key, the voices' in a shared frame. */
export type GuideChord = {
  /** Its onset and length, in beats from the start of the section. */
  at: number
  beats: number
  /** The scale degree its triad is built on, 0 to 6. */
  root: number
  /** The lower voice's degree, in the frame. */
  bass: number
  /** The upper voice's first degree, in the frame. */
  upper: number
  function: ChordFunction
}

/** A section's two-voice guide. */
export type TwoVoiceGuide = {
  beats: number
  chords: GuideChord[]
  /** The lower voice, a note a chord: [degree, beats]. */
  lower: [number, number][]
  /** The upper voice, one or two notes a chord: [degree, beats]. */
  upper: [number, number][]
  /** Which chord is the furthest from home: the arc's turning point. */
  furthest: number
}

/** How a section ends: on the fifth degree, open, into what follows, or home, through the fifth. */
export type Ending = 'half' | 'full'

/** The costs a guide is composed by, in one place, so a tweak is one number. */
export const guideCosts = {
  /** What each chord change costs, against what the words' leaning gains: only the strongest leaning buys one. */
  change: 2.5,
  /** How much a change gains: on a stressed syllable, more on beats 1 and 3; on a long note; on a word starting on 1 or 3; on a phrase point. */
  stressed: 2,
  strongBeat: 1,
  longNote: 1.5,
  wordOnBeat: 1,
  lineStart: 3,
  afterComma: 2,
  numberGroup: 3,
  barLine: 0.3,
  /** How sharply the path of chords keeps to the arc, and how adventurous its sampling is. */
  arc: 0.6,
  temperature: 0.7,
  /** How much matching last iteration's chord at the same place gains. */
  guidePull: 0.4,
}

/** The lowest and highest chord in beats and seconds: at least one beat and 0.6 s, at most two bars and 6 s. */
export function chordLengths(bpm: number): { least: number; most: number } {
  const half = (x: number) => Math.round(x * 2) / 2
  const least = Math.max(1, Math.ceil(((0.6 * bpm) / 60) * 2) / 2)
  const most = Math.max(least, Math.min(8, Math.floor(((6 * bpm) / 60) * 2) / 2))
  return { least: half(least), most: half(most) }
}

/** How far each chord of the mode stands from home: the tonic's family, the subdominant's, the dominant's. */
const distance = [0, 1.2, 0.7, 1, 2, 0.5, 2] as const
const functionOf = (root: number): ChordFunction => (distance[root]! >= 2 ? 'tension' : distance[root]! >= 1 ? 'away' : 'home')

/**
 * Where the chords change: the start, and then the places the words lean
 * on most, each chord between `least` and `most` beats long.
 */
export function changePoints(syllables: readonly TimedSyllable[], beats: number, bpm: number): number[] {
  const { least, most } = chordLengths(bpm)
  if (beats < least * 2) return [0]
  const grid = Math.round(beats * 2)
  const gain = new Array<number>(grid + 1).fill(0)
  for (let p = 0; p <= grid; p++) if ((p / 2) % 4 === 0) gain[p] = guideCosts.barLine
  for (const [i, s] of syllables.entries()) {
    const p = Math.round(s.at * 2)
    if (p <= 0 || p >= grid) continue
    const onStrong = (p / 2) % 4 === 0 || (p / 2) % 4 === 2
    let g = 0
    if (s.stress === 1) g += guideCosts.stressed + (onStrong ? guideCosts.strongBeat : 0)
    if (s.beats >= 1) g += guideCosts.longNote
    if (s.begins && onStrong) g += guideCosts.wordOnBeat
    const before = syllables[i - 1]
    if (before?.lineEnd) g += guideCosts.lineStart
    else if (before?.comma) g += guideCosts.afterComma
    if (s.group) g += guideCosts.numberGroup
    gain[p] = Math.max(gain[p]!, g)
  }
  // the best placement of changes: best[p] the most gained with a change at p
  const [lo, hi] = [Math.round(least * 2), Math.round(most * 2)]
  const best = new Array<{ value: number; from: number }>(grid + 1).fill({ value: -Infinity, from: -1 })
  best[0] = { value: 0, from: -1 }
  for (let p = lo; p <= grid; p++) {
    if (p !== grid && grid - p < lo) continue
    for (let q = Math.max(0, p - hi); q <= p - lo; q++) {
      if (best[q]!.value === -Infinity) continue
      const value = best[q]!.value + (p === grid ? 0 : gain[p]! - guideCosts.change)
      if (value > best[p]!.value) best[p] = { value, from: q }
    }
  }
  if (best[grid]!.value === -Infinity) return [0]
  const points: number[] = []
  for (let p = best[grid]!.from; p > 0; p = best[p]!.from) points.unshift(p / 2)
  return [0, ...points]
}

/** What moving from one chord's root to the next costs: by a fourth or fifth, by step, to its relative, or staying. */
function moveCost(a: number, b: number): number {
  const d = (((b - a) % 7) + 7) % 7
  let cost = d === 3 || d === 4 ? 0.3 : d === 1 || d === 6 ? 0.6 : d === 2 || d === 5 ? 0.7 : 2.5
  if (a === 4 && b === 0) cost -= 0.2
  if (a === 6) cost += b === 0 ? -0.2 : 1.5
  return cost
}

/**
 * The roots of `count` chords: the first `departure`, the last the cadence,
 * and those between sampled along the arc, rising to their furthest point
 * late in the section. `previous` is last iteration's roots, a gentle pull.
 */
export function chordPath(
  count: number,
  ending: Ending,
  random: () => number,
  { departure = 0, previous }: { departure?: number; previous?: readonly number[] } = {},
): number[] {
  if (count <= 0) return []
  if (count === 1) return [ending === 'full' ? 0 : departure]
  const fixed = new Map<number, number>([[0, departure]])
  if (ending === 'full') {
    fixed.set(count - 1, 0)
    fixed.set(count - 2, 4)
  } else fixed.set(count - 1, 4)
  if (count === 2 && ending === 'full') fixed.delete(0)
  const target = (i: number) => {
    const x = count === 1 ? 0 : i / (count - 1)
    return x <= 0.75 ? (1.6 * x) / 0.75 : 1.6
  }
  const pull = (i: number, root: number) => {
    if (!previous?.length) return 0
    const j = Math.round((i / Math.max(1, count - 1)) * (previous.length - 1))
    return previous[j] === root ? -guideCosts.guidePull : 0
  }
  const node = (i: number, root: number) =>
    fixed.has(i) ? (fixed.get(i) === root ? 0 : Infinity) : guideCosts.arc * Math.abs(distance[root]! - target(i)) + pull(i, root)
  const weight = (cost: number) => (Number.isFinite(cost) ? Math.exp(-cost / guideCosts.temperature) : 0)
  // forward: how well each root can be reached at each chord
  const forward: number[][] = []
  for (let i = 0; i < count; i++) {
    forward.push(
      Array.from({ length: 7 }, (_, r) => {
        const here = weight(node(i, r))
        if (i === 0) return here
        let sum = 0
        for (let q = 0; q < 7; q++) sum += forward[i - 1]![q]! * weight(moveCost(q, r))
        return sum * here
      }),
    )
  }
  // backward: sample the path from the end
  const pick = (weights: number[]) => {
    const total = weights.reduce((a, b) => a + b, 0)
    let left = random() * total
    for (const [r, w] of weights.entries()) if ((left -= w) <= 0 && w > 0) return r
    return weights.findLastIndex((w) => w > 0)
  }
  const roots = new Array<number>(count)
  roots[count - 1] = pick(forward[count - 1]!)
  for (let i = count - 2; i >= 0; i--) roots[i] = pick(forward[i]!.map((f, q) => f * weight(moveCost(q, roots[i + 1]!))))
  return roots
}

/** The frame the two voices are heard in: the key's tonic where a woman or child sings it. */
const frameTonic = 57
/** Where each voice may go, in degrees of the frame: the lower about an octave below the upper. */
const lowerWindow = [-7, 0] as const
const upperWindow = [0, 7] as const

const consonant = new Set([3, 4, 8, 9])
const perfect = new Set([0, 7])
const classOf = (degree: number) => ((degree % 7) + 7) % 7
const inChord = (degree: number, root: number) => [0, 2, 4].includes(classOf(degree - root))

/**
 * The two voices over a path of chords, by the rules of counterpoint, the
 * cheapest under a little of `random`'s noise: one lower note a chord, a
 * root or an inversion; one upper note a chord, a chord tone; consonant on
 * every change; contrary motion before similar; no parallel fifths or
 * octaves; and the cadence closing in by step.
 */
export function counterpoint(
  roots: readonly number[],
  ending: Ending,
  mode: readonly number[],
  random: () => number,
): { bass: number[]; upper: number[] } {
  const key: Key = { tonic: frameTonic, mode }
  const midi = (d: number) => degreeToMidi(d, key)
  const last = roots.length - 1
  type Pair = { bass: number; upper: number; cost: number }
  const pairs = (i: number): Pair[] => {
    const root = roots[i]!
    const found: Pair[] = []
    for (let bass = lowerWindow[0]; bass <= lowerWindow[1]; bass++) {
      if (!inChord(bass, root)) continue
      const inversion = classOf(bass - root)
      for (let upper = upperWindow[0]; upper <= upperWindow[1]; upper++) {
        if (!inChord(upper, root)) continue
        const apart = midi(upper) - midi(bass)
        if (apart < 3) continue
        const folded = apart % 12
        const edge = i === 0 || i === last
        let cost = consonant.has(folded) ? 0 : perfect.has(folded) ? (edge ? 0.2 : 0.8) : Infinity
        if (!Number.isFinite(cost)) continue
        cost += inversion === 0 ? 0 : inversion === 2 ? 0.6 : 1.2
        if (apart > 24) cost += 1
        // the cadence: the last chord in root position, and home in the upper voice at a full close
        if (i === last && inversion !== 0) cost += 5
        if (i === last && ending === 'full' && classOf(upper) !== 0) cost += 5
        if (ending === 'full' && i === last - 1 && inversion !== 0) cost += 2
        found.push({ bass, upper, cost: cost + random() * 0.05 })
      }
    }
    return found
  }
  const motion = (from: number, to: number, costs: readonly number[]) => costs[Math.abs(to - from)] ?? costs.at(-1)! + Math.abs(to - from)
  const step = (a: Pair, b: Pair, i: number) => {
    const bassMove = b.bass - a.bass
    const upperMove = b.upper - a.upper
    let cost = motion(a.bass, b.bass, [0.4, 0.3, 0.6, 0.2, 0.2, 1.5]) + motion(a.upper, b.upper, [0.3, 0, 0.5, 1.2, 2.5])
    if (bassMove && upperMove) cost += Math.sign(bassMove) === Math.sign(upperMove) ? 0.3 : -0.3
    const was = (midi(a.upper) - midi(a.bass)) % 12
    const is = (midi(b.upper) - midi(b.bass)) % 12
    if (perfect.has(was) && was === is && bassMove && upperMove) cost += 10
    // into a perfect interval by similar motion, the upper voice leaping: a hidden fifth or octave
    if (perfect.has(is) && bassMove && upperMove && Math.sign(bassMove) === Math.sign(upperMove) && Math.abs(upperMove) > 1) cost += 1
    // the close: the upper voice arrives by step, 2 to 1 or 7 to 1 at a full close
    if (i === last && Math.abs(upperMove) !== 1) cost += ending === 'full' ? 5 : 1
    return cost
  }
  const columns = roots.map((_, i) => pairs(i))
  const best: { cost: number; from: number }[][] = [columns[0]!.map(({ cost }) => ({ cost, from: -1 }))]
  for (let i = 1; i < columns.length; i++) {
    best.push(
      columns[i]!.map((pair) => {
        let cheapest = { cost: Infinity, from: 0 }
        for (const [k, before] of columns[i - 1]!.entries()) {
          const cost = best[i - 1]![k]!.cost + step(before, pair, i)
          if (cost < cheapest.cost) cheapest = { cost, from: k }
        }
        return { cost: cheapest.cost + pair.cost, from: cheapest.from }
      }),
    )
  }
  const chosen: Pair[] = []
  let at = best.at(-1)!.reduce((b, x, k, all) => (x.cost < all[b]!.cost ? k : b), 0)
  for (let i = columns.length - 1; i >= 0; i--) {
    chosen.unshift(columns[i]![at]!)
    at = best[i]![at]!.from
  }
  return { bass: chosen.map(({ bass }) => bass), upper: chosen.map(({ upper }) => upper) }
}

/**
 * The two-voice guide for a section: `syllables` its words as they are
 * timed, `beats` its length, `bpm` its tempo, `mode` its scale, `ending`
 * how it closes. `departure` is the chord it begins on, home unless it
 * follows a section that ended elsewhere; `previous` last iteration's guide
 * for the same section, a gentle pull. The same `random` gives the same
 * guide.
 */
export function composeGuide({
  syllables,
  beats,
  bpm,
  mode,
  ending,
  random,
  departure = 0,
  previous,
}: {
  syllables: readonly TimedSyllable[]
  beats: number
  bpm: number
  mode: readonly number[]
  ending: Ending
  random: () => number
  departure?: number
  previous?: TwoVoiceGuide
}): TwoVoiceGuide {
  const points = changePoints(syllables, beats, bpm)
  const spans = points.map((at, i) => ({ at, beats: (points[i + 1] ?? beats) - at }))
  const roots = chordPath(spans.length, ending, random, { departure, previous: previous?.chords.map(({ root }) => root) })
  const { bass, upper } = counterpoint(roots, ending, mode, random)
  const chords: GuideChord[] = spans.map((span, i) => ({
    ...span,
    root: roots[i]!,
    bass: bass[i]!,
    upper: upper[i]!,
    function: functionOf(roots[i]!),
  }))
  // the lower voice holds a note a chord; the upper fills a third between two chords with
  // the note between, where the chord is long enough that both halves last half a second
  const lower: [number, number][] = chords.map(({ bass: b, beats: length }) => [b, length])
  const upperNotes: [number, number][] = []
  for (const [i, chord] of chords.entries()) {
    const next = chords[i + 1]
    const halfSeconds = ((chord.beats / 2) * 60) / bpm
    if (next && Math.abs(next.upper - chord.upper) === 2 && halfSeconds >= 0.5) {
      upperNotes.push([chord.upper, chord.beats / 2], [(chord.upper + next.upper) / 2, chord.beats / 2])
    } else upperNotes.push([chord.upper, chord.beats])
  }
  const latter = chords.map((c, i) => ({ i, d: distance[c.root]! })).filter(({ i }) => i >= chords.length / 2 && i < chords.length - 1)
  const furthest = latter.length ? latter.reduce((a, b) => (b.d > a.d ? b : a)).i : chords.length - 1
  return { beats, chords, lower, upper: upperNotes, furthest }
}

/**
 * The timed syllables of one fitted line, from its words and the notes the
 * bar fit gave it (sung notes only, a syllable each), beginning `at` beats
 * into its section.
 */
export function timedLine(
  words: readonly { stresses: readonly number[]; comma?: boolean; group?: boolean }[],
  notes: readonly (readonly [number, number])[],
  at = 0,
): TimedSyllable[] {
  const flat = words.flatMap((word) =>
    word.stresses.map((stress, i) => ({
      stress,
      begins: i === 0,
      comma: i === word.stresses.length - 1 && Boolean(word.comma),
      group: i === 0 && Boolean(word.group),
    })),
  )
  // the fitted notes are sung notes only, a syllable each, in degrees; the rest is the phrase's own
  const timed: TimedSyllable[] = []
  let t = at
  for (const [s, [, beats]] of notes.entries()) {
    if (flat[s]) timed.push({ at: t, beats, ...flat[s]!, lineEnd: false })
    t += beats
  }
  if (timed.length) timed[timed.length - 1]!.lineEnd = true
  return timed
}
