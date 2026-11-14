import { describe, expect, it } from 'bun:test'
import golden from './fixtures/chord-paths.json' with { type: 'json' }
import { chordPath, harmonizeHum, laidByPlace, roaming, type Progression } from './guide.js'
import { modes } from './scale.js'
import { wrongness } from './wrongness.js'

const known = (roots: number[]): Progression => ({ ...roaming, style: 'known', known: { from: 'test', roots } })

describe('the progression Facet by default', () => {
  it('roams exactly as the guide did before it, chord for chord', () => {
    for (const { seed, mode, count, ending, previous, roots } of golden) {
      const m = modes[mode as keyof typeof modes]
      expect(chordPath(count, ending as 'half' | 'full', wrongness(seed), { previous, mode: m })).toEqual(roots)
      expect(chordPath(count, ending as 'half' | 'full', wrongness(seed), { previous, mode: m, progression: roaming })).toEqual(roots)
    }
  })

  it('roams more or less adventurously with its temperature, and holds closer with its pull', () => {
    const differs = golden.filter(({ seed, mode, count, ending, previous, roots }) => {
      const settled = { ...roaming, temperature: 0.3, pull: 1.2 }
      return JSON.stringify(chordPath(count, ending as 'half', wrongness(seed), { previous, mode: modes[mode as 'dorian'], progression: settled })) !== JSON.stringify(roots)
    })
    expect(differs.length).toBeGreaterThan(0)
  })
})

describe('laidByPlace', () => {
  it('thins a long progression over a short section by place', () => {
    expect(laidByPlace(4, [0, 1, 2, 3, 4, 5, 6])).toEqual([0, 2, 4, 6])
  })

  it('holds a short progression longer over a long section', () => {
    expect(laidByPlace(7, [0, 5, 3])).toEqual([0, 0, 5, 5, 5, 3, 3])
  })

  it('gives way where the section is fixed', () => {
    expect(laidByPlace(4, [3, 5, 6, 2], new Map([[0, 0], [3, 4]]))).toEqual([0, 5, 6, 4])
  })
})

describe('a known progression in the guide', () => {
  const random = () => 0.5
  it('keeps the departure and a half close, the known roots filling the rest', () => {
    expect(chordPath(6, 'half', random, { progression: known([5, 3, 6, 2]) })).toEqual([0, 3, 3, 6, 6, 4])
    expect(chordPath(6, 'half', random, { departure: 4, progression: known([5, 3, 6, 2]) })[0]).toBe(4)
  })

  it('keeps the full close, V to I, over a long favourite and a short one', () => {
    const long = known([0, 6, 5, 4, 3, 2, 1, 0, 6, 5, 4, 3])
    expect(chordPath(5, 'full', random, { progression: long }).slice(-2)).toEqual([4, 0])
    expect(chordPath(9, 'full', random, { progression: known([5, 3]) })).toEqual([0, 5, 5, 5, 3, 3, 3, 4, 0])
  })

  it('needs no wrongness: the same roots over the same change points every time', () => {
    const p = known([0, 5, 2, 6])
    expect(chordPath(8, 'half', wrongness('a'), { progression: p })).toEqual(chordPath(8, 'half', wrongness('b'), { progression: p }))
  })

  it('roams when it does not know its roots yet', () => {
    const unresolved: Progression = { ...roaming, style: 'known', known: { from: 'scientist' } }
    expect(chordPath(6, 'half', wrongness('x'), { progression: unresolved })).toEqual(chordPath(6, 'half', wrongness('x')))
  })
})

describe('harmonizeHum', () => {
  const aeolian = modes.aeolian
  it('hears the triad each bar of an old hum outlines', () => {
    // A C, G D, F A, E B: i, VII, VI, v
    const notes: [number, number][] = [[57, 2], [60, 2], [55, 2], [62, 2], [53, 2], [57, 2], [64, 2], [59, 2]]
    expect(harmonizeHum(notes, aeolian)).toEqual([0, 6, 5, 4])
  })

  it('names a chord held through bars once a bar, and passes over rests and notes outside the scale', () => {
    const notes: [number, number][] = [[57, 4], [57, 2], [64, 2], [0, 4], [61, 2], [60, 2]]
    expect(harmonizeHum(notes, aeolian)).toEqual([0, 0, 0])
  })

  it('gives the same roots for the same notes, and none for silence', () => {
    const notes: [number, number][] = [[64, 2], [65, 2], [59, 2], [57, 2], [60, 2], [64, 2]]
    expect(harmonizeHum(notes, aeolian)).toEqual(harmonizeHum(notes, aeolian))
    expect(harmonizeHum([[0, 8]], aeolian)).toEqual([])
  })
})
