// The harmonizer: how the choir sings beside the lead.
//
// A choir that only sings the lead's tune a fixed step lower, every note,
// is a sound of its own, and the song keeps it as a Perspective. But it is
// not how a choir is led. Here each voice is given the lead's line and
// chooses, note by note, a consonance beside it: a third or a sixth most of
// the time, a fifth, an octave, a unison where they fall naturally. It
// would rather hold its note, or move a step, than leap. It does not move
// in fifths or octaves alongside the lead. It moves against the lead into
// the end of a line, and lands there on a third, a sixth or an octave. It
// stays within what its own body can sing, and never crosses the voice it
// stands beside. It is plain arithmetic, the old rules of part-writing, and
// the same Song is always harmonized the same way.
//
// Its base settings are a Facet the Perspectives may turn: which side of
// the lead the voices sing on, how far the first one above stands, and how
// widely the voices below spread. The defaults are traditional: below, and
// close. A chord source, heard from the band someday, may be plugged in, so
// that the voices prefer the notes the band is playing.

import type { Score, Singer } from '../index.js'
import { degreeOf, nearestDegree, vocalRange } from './reach.js'
import { degreeToMidi, type Key } from './scale.js'

/** How the harmonizer sings: its base settings. */
export type Harmony = {
  /** Voiced by the rules of part-writing, or parallel: the lead's degree and a fixed step, every note, as the song first sang. */
  style: 'voiced' | 'parallel'
  /** Which side of the lead the harmonies sing on: all below, all above, or turn about, the first above. */
  placement: 'below' | 'above' | 'alternating'
  /** How far above the lead the first voice above stands, in scale steps: 2 a third, 7 an octave. */
  above: number
  /** How widely the voices below spread from the lead: 1 as a choir stands, more for a wider one. */
  spread: number
}

/** A choir as it has always stood, led by the rules. */
export const traditional: Harmony = { style: 'voiced', placement: 'below', above: 2, spread: 1 }

/**
 * Where a chord, heard from the band someday, is: the pitch classes it
 * sounds at a beat from the start of a line, from 0 (C) to 11, or nothing
 * where it is not known.
 */
export type ChordSource = (beat: number) => readonly number[] | undefined

/** Which side of the lead each harmony voice sings on, in order. */
export function sidesOf(placement: Harmony['placement'], voices: number): ('below' | 'above')[] {
  return Array.from({ length: voices }, (_, k) =>
    placement === 'below' ? 'below' : placement === 'above' ? 'above' : k % 2 === 0 ? 'above' : 'below',
  )
}

/** Where each voice stands from the lead, by its place on its side, in scale steps. */
function homeOf(side: 'below' | 'above', place: number, { above, spread }: Harmony): number {
  const below = [2, 4, 7][place] ?? 7 + 2 * (place - 2)
  return side === 'below' ? -Math.round(below * spread) : above + ([0, 2, 5][place] ?? 5 + 2 * (place - 2))
}

/** The intervals a voice may sing beside the lead, in semitones above or below, octaves folded: unison, thirds, a fifth, sixths. */
const consonant = new Set([0, 3, 4, 7, 8, 9])
/** The perfect ones, which may not move alongside the lead. */
const perfect = new Set([0, 7])

const sign = Math.sign

/** How a step costs, by how far it moves in scale steps: holding and stepping are cheap, leaping dear. */
const motionCost = (steps: number) => [0, 0.2, 0.7, 1.6][steps] ?? 1.6 + 1.2 * (steps - 3)

/**
 * The lead's score sung by another voice, the lead's degree and a fixed
 * `harmony` step, every note, in that voice's own key: exactly as every
 * choir of the song sang before it was led.
 */
export function parallel(lead: Score, leadKey: Key, voiceKey: Key, harmony: number): Score {
  return {
    ...lead,
    notes: lead.notes.map(([midi, beats]): [number, number] =>
      midi === 0 ? [0, beats] : [degreeToMidi((degreeOf(midi, leadKey) ?? nearestDegree(midi, leadKey)) + harmony, voiceKey), beats],
    ),
  }
}

/**
 * One voice's line beside the lead, by the rules: `lead` the lead's
 * score, `frame` the key every voice is heard in, `home` where it stands
 * from the lead in scale steps (below if negative), `range` what its body
 * can sing, `neighbour` the notes of the voice it stands beside (the lead,
 * or the voice before it on its side), which it does not cross. The same
 * `random` gives the same line.
 */
export function voiceLine({
  lead,
  frame,
  home,
  range: [low, high],
  neighbour,
  random,
  chords,
}: {
  lead: Score
  frame: Key
  home: number
  range: readonly [number, number]
  neighbour: readonly number[]
  random: () => number
  chords?: ChordSource
}): Score {
  const side = home < 0 ? -1 : 1
  const sounding = lead.notes.flatMap(([midi], i) => (midi === 0 ? [] : [i]))
  const beatAt = lead.notes.reduce<number[]>((at, [, beats], i) => [...at, (at[i] ?? 0) + beats], [0])
  const last = sounding.at(-1)

  type Choice = { degree: number; midi: number; cost: number }
  const choicesAt = (i: number): Choice[] => {
    const leadMidi = lead.notes[i]![0]
    const leadDegree = nearestDegree(leadMidi, frame)
    const beside = neighbour[i] || leadMidi
    const chord = chords?.(beatAt[i]!)
    const tried = (strict: boolean): Choice[] => {
      const found: Choice[] = []
      for (let step = -16; step <= 16; step++) {
        const degree = leadDegree + step
        const midi = degreeToMidi(degree, frame)
        if (midi < low || midi > high) continue
        const apart = Math.abs(midi - leadMidi) % 12
        if (!consonant.has(apart)) continue
        // on its own side of the voice it stands beside, never across it
        if (strict && (side < 0 ? midi > beside : midi < beside)) continue
        let cost = 0.8 * Math.abs(step - home)
        if (midi === leadMidi) cost += 2.5
        if (midi === beside && beside !== leadMidi) cost += 2
        if (apart === 7) cost += 0.3
        if (chord && !chord.includes(((midi % 12) + 12) % 12)) cost += 3
        // a line ends on a third, a sixth or an octave, not hanging on a fifth
        if (i === last) cost += apart === 7 ? 1.5 : apart === 0 ? 0 : -0.5
        if (!strict) cost += 4
        found.push({ degree, midi, cost: cost + random() * 0.05 })
      }
      return found
    }
    const strict = tried(true)
    if (strict.length) return strict
    const loose = tried(false)
    if (loose.length) return loose
    // nothing consonant within reach: the lead's own note, an octave at a time into the voice's range
    let midi = leadMidi
    while (midi < low) midi += 12
    while (midi > high) midi -= 12
    return [{ degree: nearestDegree(midi, frame), midi, cost: 10 }]
  }

  // the cheapest line through every note's choices, from the first note to the last
  const columns = sounding.map((i) => ({ i, choices: choicesAt(i) }))
  const best: { cost: number; from: number }[][] = []
  for (const [c, { i, choices }] of columns.entries()) {
    if (c === 0) {
      best.push(choices.map(({ cost }) => ({ cost, from: -1 })))
      continue
    }
    const before = columns[c - 1]!
    const [leadWas, leadIs] = [lead.notes[before.i]![0], lead.notes[i]![0]]
    best.push(
      choices.map((choice) => {
        let cheapest = { cost: Infinity, from: 0 }
        for (const [p, prior] of before.choices.entries()) {
          let cost = best[c - 1]![p]!.cost + motionCost(Math.abs(choice.degree - prior.degree))
          const moved = choice.midi !== prior.midi
          if (!moved && leadIs !== leadWas) cost -= 0.2
          // no fifths or octaves in parallel with the lead
          const was = Math.abs(prior.midi - leadWas) % 12
          const is = Math.abs(choice.midi - leadIs) % 12
          if (perfect.has(was) && was === is && moved && leadIs !== leadWas) cost += 6
          // into the end of a line, against the lead
          if (i === last && moved && sign(choice.midi - prior.midi) === sign(leadIs - leadWas)) cost += 1
          if (cost < cheapest.cost) cheapest = { cost, from: p }
        }
        return { cost: cheapest.cost + choice.cost, from: cheapest.from }
      }),
    )
  }
  const chosen = new Map<number, number>()
  let at = best.at(-1)?.reduce((b, x, k, all) => (x.cost < all[b]!.cost ? k : b), 0) ?? -1
  for (let c = columns.length - 1; c >= 0 && at >= 0; c--) {
    chosen.set(columns[c]!.i, columns[c]!.choices[at]!.midi)
    at = best[c]![at]!.from
  }
  return { ...lead, notes: lead.notes.map(([midi, beats], i): [number, number] => [midi === 0 ? 0 : chosen.get(i)!, beats]) }
}

/**
 * The choir's lines beside the lead's `lead` score, one for each of
 * `voices`, in order, by `harmony`: voiced by the rules, each within its
 * own body's range and on its own side, or parallel, as the song first
 * sang. `leadKey` is the key the lead sings in, `keyOf` a voice's own.
 */
export function harmonizeChoir({
  lead,
  leadKey,
  frame,
  keyOf,
  voices,
  harmony,
  random,
  chords,
}: {
  lead: Score
  leadKey: Key
  /** The key every voice is heard in, whatever octave it sings in. */
  frame: Key
  keyOf: (body: Singer) => Key
  voices: readonly { body: Singer; harmony: number }[]
  harmony: Harmony
  random: () => number
  chords?: ChordSource
}): Score[] {
  if (harmony.style === 'parallel') {
    return voices.map((voice) => parallel(lead, leadKey, keyOf(voice.body), voice.harmony))
  }
  const sides = sidesOf(harmony.placement, voices.length)
  const leadNotes = lead.notes.map(([midi]) => midi)
  const placed = { below: 0, above: 0 }
  const nearest = { below: leadNotes, above: leadNotes }
  return voices.map((voice, k) => {
    const side = sides[k]!
    const line = voiceLine({
      lead,
      frame,
      home: homeOf(side, placed[side]++, harmony),
      range: vocalRange[voice.body],
      neighbour: nearest[side],
      random,
      chords,
    })
    nearest[side] = line.notes.map(([midi]) => midi)
    return line
  })
}
