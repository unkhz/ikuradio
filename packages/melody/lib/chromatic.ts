// Chromatic approach progressions, tonicization, and interval-guided modulation.
//
// Traditional diatonic progressions walk seven scale degrees and lean on fourths
// and fifths (V -> I). Here chords may travel by semitones (+/- 1), approach any
// target chord from a half step above or below (bII -> I, VII -> I, chromatic
// passing chords), tonicize a secondary key mid-section, or modulate an entire
// section to a new tonal center.
//
// Because MusicGen reads a guide through a 12-bin chromagram argmax (one pitch
// class per frame), every tonicization or modulation pivot exposes its defining
// interval directly in the guide (`bass -> upper -> leadSemitone`, e.g. V/T or
// bII/T pulling by a single semitone into the new tonic T), followed by the new
// tonic + characteristic third on arrival.

import type { ChordFunction, ChordQuality, Ending, GuideChord, Progression, TwoVoiceGuide } from './guide.js'
import { degreeToMidi, type Key } from './scale.js'

/** The shared frame tonic used by guides and harmonizers (A3 = MIDI 57). */
export const frameTonic = 57

export const mod12 = (n: number) => ((n % 12) + 12) % 12

/** Semitone offsets of a triad above its root. */
export function triadIntervals(quality: ChordQuality): readonly [number, number, number] {
  if (quality === 'major') return [0, 4, 7]
  if (quality === 'diminished') return [0, 3, 6]
  if (quality === 'augmented') return [0, 4, 8]
  return [0, 3, 7]
}

/** Whether the Song's home mode has a major or minor tonic triad. */
export function homeQuality(mode: readonly number[]): 'major' | 'minor' {
  return mode[2] === 4 ? 'major' : 'minor'
}

/** Quality of the diatonic triad built on `root` (0..6) in `mode`. */
export function diatonicQuality(root: number, mode: readonly number[]): ChordQuality {
  const r = ((root % 7) + 7) % 7
  const third = mod12(mode[(r + 2) % 7]! - mode[r]!)
  const fifth = mod12(mode[(r + 4) % 7]! - mode[r]!)
  if (third === 4 && fifth === 7) return 'major'
  if (third === 3 && fifth === 6) return 'diminished'
  if (third === 4 && fifth === 8) return 'augmented'
  return 'minor'
}

/** Nearest diatonic scale degree (0..6) to a semitone offset `0..11` in `mode`. */
export function nearestScaleDegree(semitone: number, mode: readonly number[]): number {
  const s = mod12(semitone)
  let best = 0
  let dist = 12
  for (let d = 0; d < mode.length; d++) {
    const raw = Math.abs(mode[d]! - s)
    const gap = Math.min(raw, 12 - raw)
    if (gap < dist) {
      dist = gap
      best = d
    }
  }
  return best
}

/** Whether a guide uses chromatic, tonicized, or modulated chords outside pure diatonic degrees. */
export function isChromaticGuide(guide: TwoVoiceGuide): boolean {
  return guide.chords.some(
    (c) =>
      c.semitone !== undefined ||
      c.bassSemitone !== undefined ||
      c.upperSemitone !== undefined ||
      c.leadSemitone !== undefined ||
      (c.center !== undefined && c.center !== 0),
  )
}

/** Pitch classes (0..11, absolute MIDI mod 12) belonging to a GuideChord in `mode` on `tonic`. */
export function chordPitchClasses(chord: GuideChord, mode: readonly number[], tonic = frameTonic): number[] {
  if (chord.semitone !== undefined) {
    const q = chord.quality ?? homeQuality(mode)
    return triadIntervals(q).map((iv) => mod12(tonic + chord.semitone! + iv))
  }
  return [0, 2, 4].map((k) => mod12(tonic + degreeToMidi(chord.root + k, { tonic: 0, mode })))
}

/** MIDI pitch of a chord's lower voice on `tonic`. */
export function chordBassMidi(chord: GuideChord, mode: readonly number[], tonic = frameTonic): number {
  if (chord.bassSemitone !== undefined) return tonic + chord.bassSemitone
  return degreeToMidi(chord.bass, { tonic, mode })
}

/** MIDI pitch of a chord's upper voice on `tonic`. */
export function chordUpperMidi(chord: GuideChord, mode: readonly number[], tonic = frameTonic): number {
  if (chord.upperSemitone !== undefined) return tonic + chord.upperSemitone
  return degreeToMidi(chord.upper, { tonic, mode })
}

/** MIDI pitch of a chord's leading/approach interval note on `tonic`, if any. */
export function chordLeadMidi(chord: GuideChord, tonic = frameTonic): number | undefined {
  return chord.leadSemitone !== undefined ? tonic + chord.leadSemitone : undefined
}

export type ChromaticSpec = {
  semitone: number
  quality: ChordQuality
  center: number
  function: ChordFunction
  /** Optional semitone pitch class (0..11 relative to Song tonic) to expose as leading-tone/approach interval. */
  leadClass?: number
  /** Prefer root position bass (e.g. tonic arrivals and cadences). */
  grounded?: boolean
}

const chromaticFunction = (semitone: number, center: number): ChordFunction => {
  const rel = mod12(semitone - center)
  if (rel === 0 || rel === 3 || rel === 4 || rel === 8 || rel === 9) return rel === 0 ? 'home' : 'away'
  if (rel === 1 || rel === 6 || rel === 7 || rel === 11) return 'tension'
  return 'away'
}

/** Musical default quality for a semitone offset relative to `center`, given the home mode's color. */
function qualityForRel(rel: number, homeQ: 'major' | 'minor'): ChordQuality {
  const r = mod12(rel)
  if (r === 0) return homeQ
  if (r === 1) return 'major' // Neapolitan / tritone-sub bII
  if (r === 2) return 'minor'
  if (r === 3) return 'major' // bIII chromatic mediant / relative major
  if (r === 4) return homeQ === 'minor' ? 'major' : 'minor'
  if (r === 5) return homeQ
  if (r === 6) return 'diminished' // #IVdim / bV passing
  if (r === 7) return 'major' // V dominant color
  if (r === 8) return 'major' // bVI cinematic mediant
  if (r === 9) return homeQ === 'major' ? 'minor' : 'diminished'
  if (r === 10) return 'major' // bVII
  return 'diminished' // vii° leading chord
}

/**
 * Generates a chromatic chord progression where semitone motion (+/- 1) plays
 * the primary harmonic role instead of circle-of-fifths jumps.
 */
export function chromaticSteps(
  count: number,
  ending: Ending,
  mode: readonly number[],
  random: () => number,
  flavor: NonNullable<Progression['chromatic']> = 'approach',
): ChromaticSpec[] {
  const homeQ = homeQuality(mode)
  if (count <= 0) return []
  if (count === 1) return [{ semitone: 0, quality: homeQ, center: 0, function: 'home', grounded: true }]

  const make = (semitone: number, quality?: ChordQuality, extra?: Partial<ChromaticSpec>): ChromaticSpec => {
    const s = mod12(semitone)
    return {
      semitone: s,
      quality: quality ?? qualityForRel(s, homeQ),
      center: 0,
      function: chromaticFunction(s, 0),
      ...extra,
    }
  }

  if (flavor === 'descent') {
    // Lament / line-cliché chromatic bass descent: 0 -> 11 -> 10 -> 9 -> 8 -> 7 ...
    const walk = [0, 11, 10, 9, 8, 7, 6, 5]
    const out: ChromaticSpec[] = []
    for (let i = 0; i < count; i++) {
      if (i === 0) {
        out.push(make(0, homeQ, { grounded: true }))
      } else if (ending === 'full' && i === count - 1) {
        out.push(make(0, homeQ, { grounded: true }))
      } else if (ending === 'full' && i === count - 2) {
        // Half-step bII -> I resolution (or leading-tone VII -> I)
        const approach = random() < 0.72 ? 1 : 11
        out.push(make(approach, approach === 1 ? 'major' : 'diminished', { function: 'tension', leadClass: approach === 1 ? 1 : 11 }))
      } else if (ending === 'half' && i === count - 1) {
        const halfEnd = random() < 0.55 ? 1 : 7
        out.push(make(halfEnd, 'major', { function: 'tension', leadClass: halfEnd === 1 ? 1 : 11 }))
      } else {
        const s = walk[i % walk.length]!
        const q: ChordQuality = s === 11 ? 'minor' : s === 10 ? 'major' : s === 9 ? 'minor' : s === 8 ? 'major' : s === 7 ? 'major' : qualityForRel(s, homeQ)
        out.push(make(s, q))
      }
    }
    return out
  }

  if (flavor === 'climb') {
    // Rising chromatic tension: 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 ...
    const walk = [0, 1, 2, 3, 4, 5, 6, 7]
    const out: ChromaticSpec[] = []
    for (let i = 0; i < count; i++) {
      if (i === 0) {
        out.push(make(0, homeQ, { grounded: true }))
      } else if (ending === 'full' && i === count - 1) {
        out.push(make(0, homeQ, { grounded: true }))
      } else if (ending === 'full' && i === count - 2) {
        // Ascending leading-tone pull (11 -> 0) or upper chromatic slide (1 -> 0)
        const approach = random() < 0.55 ? 11 : 1
        out.push(make(approach, approach === 1 ? 'major' : 'diminished', { function: 'tension', leadClass: approach }))
      } else if (ending === 'half' && i === count - 1) {
        out.push(make(7, 'major', { function: 'tension', leadClass: 11 }))
      } else {
        const s = walk[i % walk.length]!
        out.push(make(s))
      }
    }
    return out
  }

  if (flavor === 'approach') {
    // Pillar targets approached by +/- 1 semitone instead of jumping V -> ii -> V -> I
    const pillars = [
      [5, 8], // iv / bVI
      [3, 8], // bIII / bVI
      [4, 7], // III / V
      [5, 7], // iv / V
      [8, 3], // bVI / bIII
    ]
    const [p1, p2] = pillars[Math.floor(random() * pillars.length)]!
    const dir1 = random() < 0.5 ? 1 : -1
    const dir2 = random() < 0.5 ? 1 : -1
    // Core sequence: Home -> approach(p1) -> p1 -> approach(p2) -> p2 -> half-step cadence
    const core: ChromaticSpec[] = [
      make(0, homeQ, { grounded: true }),
      make(p1 + dir1, dir1 === 1 ? 'major' : 'diminished', { function: 'tension', leadClass: mod12(p1 + dir1) }),
      make(p1, undefined, { grounded: true }),
      make(p2 + dir2, dir2 === 1 ? 'major' : 'diminished', { function: 'tension', leadClass: mod12(p2 + dir2) }),
      make(p2, undefined, { grounded: true }),
    ]
    const out: ChromaticSpec[] = []
    for (let i = 0; i < count; i++) {
      if (i === 0) {
        out.push(core[0]!)
      } else if (ending === 'full' && i === count - 1) {
        out.push(make(0, homeQ, { grounded: true }))
      } else if (ending === 'full' && i === count - 2) {
        const approach = random() < 0.7 ? 1 : 11
        out.push(make(approach, approach === 1 ? 'major' : 'diminished', { function: 'tension', leadClass: approach }))
      } else if (ending === 'half' && i === count - 1) {
        // Leave poised a semitone away from home (bII) or on V approached by semitone
        const halfEnd = random() < 0.6 ? 1 : 7
        out.push(make(halfEnd, 'major', { function: 'tension', leadClass: halfEnd === 1 ? 1 : 11 }))
      } else {
        const idx = Math.round(((i - 1) / Math.max(1, count - 3)) * (core.length - 2)) + 1
        out.push(core[Math.min(core.length - 1, Math.max(1, idx))]!)
      }
    }
    return out
  }

  // 'roam': 12-tone semitone-weighted Markov walk where +/- 1 semitone is the cheapest move
  const chromaticMoveCost = (a: number, b: number) => {
    const d = mod12(b - a)
    if (d === 0) return 2.6
    if (d === 1 || d === 11) return 0.25 // semitone: primary gravity!
    if (d === 3 || d === 4 || d === 8 || d === 9) return 0.55 // chromatic mediants
    if (d === 2 || d === 10) return 0.65 // whole step
    if (d === 6) return 0.9 // tritone
    return 1.15 // fourth/fifth deliberately costlier than semitones
  }
  const fixed = new Map<number, number>([[0, 0]])
  if (ending === 'full') {
    fixed.set(count - 1, 0)
    fixed.set(count - 2, random() < 0.65 ? 1 : 11)
  } else {
    fixed.set(count - 1, random() < 0.55 ? 1 : 7)
  }
  if (count === 2 && ending === 'full') fixed.delete(0)
  const temp = 0.65
  const weight = (cost: number) => (Number.isFinite(cost) ? Math.exp(-cost / temp) : 0)
  const forward: number[][] = []
  for (let i = 0; i < count; i++) {
    forward.push(
      Array.from({ length: 12 }, (_, r) => {
        const here = fixed.has(i) ? (fixed.get(i) === r ? 1 : 0) : 1
        if (i === 0) return here
        let sum = 0
        for (let q = 0; q < 12; q++) sum += forward[i - 1]![q]! * weight(chromaticMoveCost(q, r))
        return sum * here
      }),
    )
  }
  const pickW = (weights: number[]) => {
    const total = weights.reduce((a, b) => a + b, 0)
    let left = random() * total
    for (const [r, w] of weights.entries()) if ((left -= w) <= 0 && w > 0) return r
    return weights.findLastIndex((w) => w > 0)
  }
  const roots = new Array<number>(count)
  roots[count - 1] = pickW(forward[count - 1]!)
  for (let i = count - 2; i >= 0; i--) {
    roots[i] = pickW(forward[i]!.map((f, q) => f * weight(chromaticMoveCost(q, roots[i + 1]!))))
  }
  return roots.map((s, i) => {
    const isCadenceApproach = ending === 'full' && i === count - 2
    const isHalfEnd = ending === 'half' && i === count - 1
    return make(s, undefined, {
      ...(i === 0 || (ending === 'full' && i === count - 1) ? { grounded: true } : {}),
      ...(isCadenceApproach ? { function: 'tension', leadClass: s === 1 ? 1 : 11 } : {}),
      ...(isHalfEnd ? { function: 'tension', leadClass: s === 1 ? 1 : 11 } : {}),
    })
  })
}

/**
 * Generates a tonicized chord progression that departs home, pivots into a
 * secondary tonal center `T` via an explicit key-defining interval (V/T with
 * leading tone `T - 1`, or chromatic `bII/T`), dwells in `T`, and resolves back
 * home on full cadences.
 */
export function tonicizedSteps(
  count: number,
  ending: Ending,
  mode: readonly number[],
  random: () => number,
  target?: number,
): ChromaticSpec[] {
  const homeQ = homeQuality(mode)
  if (count <= 0) return []
  if (count === 1) return [{ semitone: 0, quality: homeQ, center: 0, function: 'home', grounded: true }]

  const targets = [3, 4, 5, 7, 8, 1, 2]
  const T = target && mod12(target) !== 0 ? mod12(target) : targets[Math.floor(random() * targets.length)]!
  // Relative major (3), chromatic mediants (4, 8), and Neapolitan (1) bloom major; iv/v/ii adapt cleanly
  const targetQ: 'major' | 'minor' = T === 3 || T === 4 || T === 8 || T === 1 ? 'major' : T === 2 ? 'minor' : homeQ
  const useChromaticPivot = random() < 0.45
  const pivotRoot = useChromaticPivot ? mod12(T + 1) : mod12(T + 7) // bII/T or V/T
  const leadIntoT = mod12(T - 1) // leading tone right underneath T

  const out: ChromaticSpec[] = []
  if (count <= 3) {
    out.push({ semitone: 0, quality: homeQ, center: 0, function: 'home', grounded: true })
    if (count === 2) {
      out.push({ semitone: pivotRoot, quality: 'major', center: T, function: 'tension', leadClass: leadIntoT })
    } else {
      out.push({ semitone: pivotRoot, quality: 'major', center: T, function: 'tension', leadClass: leadIntoT })
      out.push(
        ending === 'full'
          ? { semitone: 0, quality: homeQ, center: 0, function: 'home', grounded: true }
          : { semitone: T, quality: targetQ, center: T, function: 'away', grounded: true },
      )
    }
    return out
  }

  // Regions: opening in home (0..pivotIdx-1), pivot -> tonicized island in T, optional return cadence to home
  const pivotIdx = Math.max(1, Math.floor(count * 0.28))
  const returnIdx = ending === 'full' ? Math.max(pivotIdx + 2, count - 2) : count
  const islandWalk = [
    { rel: 0, q: targetQ, grounded: true },
    { rel: 5, q: targetQ, grounded: false },
    { rel: 1, q: 'major' as const, grounded: false, lead: mod12(T - 1) }, // bII/T or subdominant color
    { rel: 7, q: 'major' as const, grounded: false, lead: mod12(T - 1) },
    { rel: 0, q: targetQ, grounded: true },
  ]

  for (let i = 0; i < count; i++) {
    if (i < pivotIdx) {
      const s = i === 0 ? 0 : mode[i === 1 ? 3 : 5]!
      out.push({
        semitone: mod12(s),
        quality: i === 0 ? homeQ : diatonicQuality(i === 1 ? 3 : 5, mode),
        center: 0,
        function: i === 0 ? 'home' : 'away',
        ...(i === 0 ? { grounded: true } : {}),
      })
    } else if (i === pivotIdx) {
      // Explicit interval pivot into T: V/T (or bII/T) exposing leading tone T - 1!
      out.push({
        semitone: pivotRoot,
        quality: 'major',
        center: T,
        function: 'tension',
        leadClass: leadIntoT,
      })
    } else if (i < returnIdx) {
      const step = islandWalk[(i - pivotIdx - 1) % islandWalk.length]!
      out.push({
        semitone: mod12(T + step.rel),
        quality: step.q,
        center: T,
        function: step.rel === 0 ? 'away' : step.rel === 7 || step.rel === 1 ? 'tension' : 'away',
        ...(step.grounded ? { grounded: true } : {}),
        ...(step.lead !== undefined ? { leadClass: step.lead } : {}),
      })
    } else if (i === count - 2 && ending === 'full') {
      // Return pivot into home: V (7) or chromatic bII (1) exposing leading tone 11 -> 0
      const back = random() < 0.5 ? 7 : 1
      out.push({
        semitone: back,
        quality: 'major',
        center: 0,
        function: 'tension',
        leadClass: back === 7 ? 11 : 1,
      })
    } else {
      out.push({
        semitone: 0,
        quality: homeQ,
        center: 0,
        function: 'home',
        grounded: true,
      })
    }
  }
  return out
}

/**
 * Converts a diatonic chord sequence into chromatic specs shifted by `shift` semitones,
 * so any progression style (`roaming`, `known`, `chromatic`, `tonicize`) can modulate cleanly.
 */
export function shiftChords(specs: readonly ChromaticSpec[], shift: number): ChromaticSpec[] {
  const s = mod12(shift)
  if (s === 0) return [...specs]
  return specs.map((c) => ({
    ...c,
    semitone: mod12(c.semitone + s),
    center: mod12(c.center + s),
    ...(c.leadClass !== undefined ? { leadClass: mod12(c.leadClass + s) } : {}),
  }))
}

/**
 * Turns a diatonic root path into ChromaticSpecs (used when modulating a `roaming` or `known`
 * section by `shift` semitones, or adding a modulating pivot at the end for `nextShift`).
 */
export function diatonicToChromaticSpecs(roots: readonly number[], mode: readonly number[]): ChromaticSpec[] {
  return roots.map((root, i) => ({
    semitone: mod12(mode[((root % 7) + 7) % 7]!),
    quality: diatonicQuality(root, mode),
    center: 0,
    function: root === 0 || root === 2 || root === 5 ? (root === 0 ? 'home' : 'away') : root === 4 || root === 6 ? 'tension' : 'away',
    ...(i === 0 || i === roots.length - 1 ? { grounded: true } : {}),
  }))
}

/**
 * Rewrites the final chord of a section into a modulating pivot chord pointing into
 * `nextShift` (V/nextShift or chromatic bII/nextShift with explicit leading tone `nextShift - 1`)
 * so MusicGen hears the exact key-change interval as the outgoing bed fades into the next section!
 */
export function applyModulationPivot(
  specs: readonly ChromaticSpec[],
  currentShift: number,
  nextShift: number,
  random: () => number,
): ChromaticSpec[] {
  if (!specs.length || mod12(currentShift) === mod12(nextShift)) return [...specs]
  const target = mod12(nextShift)
  const useHalfStep = random() < 0.45
  const pivotRoot = useHalfStep ? mod12(target + 1) : mod12(target + 7) // bII/target or V/target
  const leadClass = mod12(target - 1) // leading tone directly under the incoming tonic!
  const copy = [...specs]
  copy[copy.length - 1] = {
    semitone: pivotRoot,
    quality: 'major',
    center: target,
    function: 'tension',
    leadClass,
    grounded: true,
  }
  return copy
}

const consonantSemitones = new Set([3, 4, 8, 9])
const perfectSemitones = new Set([0, 7])

/**
 * Smooth chromatic two-voice counterpoint over `specs`: places `bassSemitone` in `[-12..0]`
 * and `upperSemitone` in `[0..12]` (semitones from `frameTonic`), maximizing half-step/whole-step
 * voice leading, avoiding parallel fifths/octaves, and computing `leadSemitone` in the upper
 * voice's register whenever a pivot/approach chord signals a tonicization or key change.
 */
export function chromaticCounterpoint(
  specs: readonly ChromaticSpec[],
  ending: Ending,
  random: () => number,
): { bass: number[]; upper: number[]; lead: (number | undefined)[] } {
  const last = specs.length - 1
  type Pair = { bass: number; upper: number; cost: number }
  const pairs = (i: number): Pair[] => {
    const spec = specs[i]!
    const tones = triadIntervals(spec.quality).map((iv) => mod12(spec.semitone + iv))
    const found: Pair[] = []
    for (let bass = -12; bass <= 0; bass++) {
      const bClass = mod12(bass)
      const inv = tones.indexOf(bClass)
      if (inv < 0) continue
      for (let upper = 0; upper <= 12; upper++) {
        const uClass = mod12(upper)
        if (!tones.includes(uClass)) continue
        const apart = upper - bass
        if (apart < 3) continue
        const folded = apart % 12
        const edge = i === 0 || i === last || Boolean(spec.grounded)
        let cost = consonantSemitones.has(folded) ? 0 : perfectSemitones.has(folded) ? (edge ? 0.15 : 0.75) : Infinity
        // Allow diminished fifth / augmented fifth inside dim/aug chords
        if (!Number.isFinite(cost) && (spec.quality === 'diminished' || spec.quality === 'augmented') && (folded === 6 || folded === 8)) {
          cost = 0.45
        }
        if (!Number.isFinite(cost)) continue
        // Root position strongly preferred on grounded/arrival chords so MusicGen hears the new root clearly
        cost += inv === 0 ? 0 : spec.grounded ? 3.5 : inv === 1 ? 0.55 : 1.1
        if (apart > 22) cost += 0.8
        if (i === last && inv !== 0) cost += 4
        if (i === last && ending === 'full' && uClass !== mod12(spec.center)) cost += 3.5
        // On a key-arrival chord, reward the characteristic third (index 1) or tonic in the upper voice
        if (spec.grounded && i > 0 && uClass === tones[1]) cost -= 0.4
        found.push({ bass, upper, cost: cost + random() * 0.05 })
      }
    }
    if (!found.length) {
      // Fallback: root in bass (-12..0) and third in upper (0..12)
      const bass = spec.semitone === 0 ? -12 : spec.semitone - 12
      const upper = mod12(spec.semitone + triadIntervals(spec.quality)[1])
      return [{ bass, upper, cost: 5 }]
    }
    return found
  }

  const semiMotion = (delta: number, isUpper: boolean) => {
    const d = Math.abs(delta)
    if (d === 0) return isUpper ? 0.35 : 0.45
    if (d === 1) return 0 // half-step voice leading is golden!
    if (d === 2) return 0.15
    if (d === 3 || d === 4) return 0.45
    if (d === 5 || d === 7) return isUpper ? 1.1 : 0.35
    return 1.2 + (d - 5) * 0.35
  }

  const stepCost = (a: Pair, b: Pair, i: number) => {
    const bassMove = b.bass - a.bass
    const upperMove = b.upper - a.upper
    let cost = semiMotion(bassMove, false) + semiMotion(upperMove, true)
    if (bassMove && upperMove) cost += Math.sign(bassMove) === Math.sign(upperMove) ? 0.25 : -0.3
    const was = (a.upper - a.bass) % 12
    const is = (b.upper - b.bass) % 12
    if (perfectSemitones.has(was) && was === is && bassMove && upperMove) cost += 10
    if (i === last && ending === 'full' && Math.abs(upperMove) > 2) cost += 3
    return cost
  }

  const columns = specs.map((_, i) => pairs(i))
  const best: { cost: number; from: number }[][] = [columns[0]!.map(({ cost }) => ({ cost, from: -1 }))]
  for (let i = 1; i < columns.length; i++) {
    best.push(
      columns[i]!.map((pair) => {
        let cheapest = { cost: Infinity, from: 0 }
        for (const [k, before] of columns[i - 1]!.entries()) {
          const cost = best[i - 1]![k]!.cost + stepCost(before, pair, i)
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

  // Place each chord's `leadSemitone` in `[0..12]` closest to its upper voice (or next chord's upper voice)
  const lead = specs.map((spec, i) => {
    if (spec.leadClass === undefined) return undefined
    const target = chosen[i + 1]?.upper ?? chosen[i]!.upper
    const candidates = [spec.leadClass, spec.leadClass + 12, spec.leadClass - 12].filter((p) => p >= -2 && p <= 14)
    return candidates.reduce((bestP, p) => (Math.abs(p - target) < Math.abs(bestP - target) ? p : bestP), spec.leadClass)
  })

  return {
    bass: chosen.map(({ bass }) => bass),
    upper: chosen.map(({ upper }) => upper),
    lead,
  }
}

/** A guide voice in absolute MIDI pitches (or null for rest) and beats. */
export type MidiTurn = [midi: number | null, beats: number]

/**
 * How a two-voice guide is hummed for MusicGen in exact MIDI pitches: works identically
 * for diatonic guides AND chromatic/tonicized/modulated guides.
 *
 * On normal chords, the lower voice opens on the bass and the upper voice finishes on
 * the upper chord tone (`bass -> upper`). On a pivot/approach chord carrying `leadSemitone`
 * (signaling a tonicization or key modulation!), the guide explicitly articulates the
 * key-defining interval: `bass -> upper -> leadSemitone` (when the chord lasts >= 1.5 s)
 * or `bass -> leadSemitone` (on shorter chords), so MusicGen's chromagram reads the exact
 * leading-tone / semitone pull into the new key!
 */
export function inTurnsPitches(guide: TwoVoiceGuide, key: Key, bpm: number): { lower: MidiTurn[]; upper: MidiTurn[] } {
  const half = (0.5 * bpm) / 60
  const lower: MidiTurn[] = []
  const upper: MidiTurn[] = []
  const push = (voice: MidiTurn[], midi: number | null, beats: number) => {
    const last = voice.at(-1)
    if (last && last[0] === null && midi === null) last[1] += beats
    else voice.push([midi, beats])
  }
  for (const chord of guide.chords) {
    const bassMidi = chordBassMidi(chord, key.mode, key.tonic)
    const upperMidi = chordUpperMidi(chord, key.mode, key.tonic)
    const leadMidi = chordLeadMidi(chord, key.tonic)
    if (leadMidi !== undefined && leadMidi !== upperMidi && chord.beats >= 3 * half) {
      // Three-step interval articulation for MusicGen: bass -> chord tone -> leading/approach tone!
      const b1 = Math.max(half, chord.beats * 0.35)
      const b3 = Math.max(half, chord.beats * 0.3)
      const b2 = Math.max(half, chord.beats - b1 - b3)
      const scale = chord.beats / (b1 + b2 + b3)
      push(lower, bassMidi, b1 * scale)
      push(upper, null, b1 * scale)
      push(lower, null, b2 * scale)
      push(upper, upperMidi, b2 * scale)
      push(lower, null, b3 * scale)
      push(upper, leadMidi, b3 * scale)
    } else {
      const lead = chord.beats >= 2 * half ? Math.min(chord.beats - half, Math.max(half, chord.beats / 2)) : chord.beats
      push(lower, bassMidi, lead)
      push(upper, null, lead)
      if (lead < chord.beats) {
        push(lower, null, chord.beats - lead)
        // On a short pivot chord, expose the leading-tone/approach pitch directly in the second half
        push(upper, leadMidi ?? upperMidi, chord.beats - lead)
      }
    }
  }
  return { lower, upper }
}
