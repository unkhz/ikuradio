import { drift } from './drift.js'
import { settle } from './character.js'

const pool = ['a', 'b', 'c', 'd', 'e']
const first = () => 0

describe('drift', () => {
  it('lets the oldest description go and one new arrive', () => {
    expect(drift(['a', 'b'], pool, 2, first)).toEqual(['b', 'c'])
  })

  it('never brings back a description that is already there', () => {
    for (let i = 0; i < 50; i++) {
      const next = drift(['a', 'b', 'c'], pool, 3)
      expect(new Set(next).size).toBe(3)
      expect(next.slice(0, 2)).toEqual(['b', 'c'])
    }
  })

  it('grows or shrinks to the count it is asked for', () => {
    expect(drift(['a'], pool, 3, first)).toEqual(['a', 'b', 'c'])
    expect(drift(['a', 'b', 'c', 'd'], pool, 2, first)).toEqual(['d', 'e'])
  })

  it('changes completely when a Mood is only one description', () => {
    expect(drift(['a'], pool, 1, first)).toEqual(['b'])
  })
})

describe('settle', () => {
  it('lets the tempo walk, not leap', () => {
    expect(settle(130, 76)).toBe(92)
    expect(settle(40, 76)).toBe(60)
    expect(settle(80, 76)).toBe(80)
  })

  it('keeps the tempo singable', () => {
    expect(settle(200, 130)).toBe(132)
    expect(settle(10, 60)).toBe(56)
  })
})
