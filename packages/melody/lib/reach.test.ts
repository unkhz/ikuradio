import { describe, expect, it } from 'bun:test'
import { keyFor } from '../index.js'
import { firstTune } from './variation.js'
import { degreeOf, leapScore, leapTune, leaping, nearestDegree, vocalRange } from './reach.js'
import { degreeToMidi } from './scale.js'
import { wrongness } from './wrongness.js'

const key = keyFor('female', 'aeolian')
const range = vocalRange.female

describe('degreeOf', () => {
  it('finds the degree of every note in the key, and none for silence or a note outside it', () => {
    for (let degree = -7; degree <= 14; degree++) expect(degreeOf(degreeToMidi(degree, key), key)).toBe(degree)
    expect(degreeOf(0, key)).toBeUndefined()
    expect(degreeOf(58, key)).toBeUndefined() // A sharp, outside A minor
    expect(degreeToMidi(nearestDegree(58, key), key)).toBe(57)
  })
})

describe('vocalRange', () => {
  it('gives every body a range of its own, the child highest and the man lowest', () => {
    expect(vocalRange.child[1]).toBeGreaterThan(vocalRange.female[1])
    expect(vocalRange.male[0]).toBeLessThan(vocalRange.female[0])
    for (const [low, high] of Object.values(vocalRange)) expect(high - low).toBeGreaterThan(24)
  })
})

describe('leaping', () => {
  const walk = [0, 1, 2, 2, 1, 0, -1, 0]
  const tones = (a: number, b: number) => Math.abs(degreeToMidi(a, key) - degreeToMidi(b, key)) / 2

  it('makes every change of note leap between the least and the most whole tones, and keeps the repeats', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const leapt = leaping(walk, key, [3, 6], wrongness(seed), range)
      for (let i = 1; i < walk.length; i++) {
        if (walk[i] === walk[i - 1]) expect(leapt[i]).toBe(leapt[i - 1]!)
        else {
          expect(tones(leapt[i]!, leapt[i - 1]!)).toBeGreaterThanOrEqual(3)
          expect(tones(leapt[i]!, leapt[i - 1]!)).toBeLessThanOrEqual(6)
        }
      }
    }
  })

  it('stays within the voice, leaping down near the top and up near the bottom', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const leapt = leaping([9, 10, 9, 10, -4, -5, -4], key, [5, 12], wrongness(seed), range)
      for (const degree of leapt) {
        expect(degreeToMidi(degree, key)).toBeGreaterThanOrEqual(range[0])
        expect(degreeToMidi(degree, key)).toBeLessThanOrEqual(range[1])
      }
    }
  })

  it('leaps the same for the same Song', () => {
    expect(leaping(walk, key, [4, 9], wrongness('leaps:7'), range)).toEqual(leaping(walk, key, [4, 9], wrongness('leaps:7'), range))
  })
})

describe('leapTune', () => {
  it('makes the verses leap, to their own rhythm, and never touches the chorus', () => {
    const leapt = leapTune(firstTune, key, [4, 8], wrongness('leaps:1'), range)
    expect(leapt.chorus).toEqual(firstTune.chorus)
    for (const [p, phrase] of leapt.verse.entries()) {
      expect(phrase.notes.map(([, beats]) => beats)).toEqual(firstTune.verse[p]!.notes.map(([, beats]) => beats))
      expect(phrase.rest).toBe(firstTune.verse[p]!.rest)
    }
    expect(leapt.verse).not.toEqual(firstTune.verse)
  })
})

describe('leapScore', () => {
  it('keeps the rests and the rhythm, and lands every leap on a note of the key', () => {
    const notes: [number, number][] = [[57, 1], [59, 1], [0, 1], [60, 2], [62, 1]]
    const leapt = leapScore({ notes }, key, [4, 6], wrongness('bridge'), range)
    expect(leapt.notes.map(([, beats]) => beats)).toEqual(notes.map(([, beats]) => beats))
    expect(leapt.notes[2]).toEqual([0, 1])
    for (const [midi] of leapt.notes) if (midi) expect(degreeOf(midi, key)).toBeDefined()
  })
})
