import { describe, expect, it } from 'bun:test'
import { keyFor } from '../index.js'
import { degreeOf, nearestDegree, vocalRange } from './reach.js'
import { degreeToMidi } from './scale.js'

const key = keyFor('female', 'aeolian')

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
