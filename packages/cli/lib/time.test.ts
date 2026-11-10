import { describe, expect, it } from 'bun:test'
import { placements } from './time.js'

describe('placements', () => {
  const score = {
    iteration: '3',
    lines: [
      { file: 'a.m4a', at: 0 },
      { file: 'b.m4a', at: 6.3 },
    ],
    beds: [{ file: 'bed.m4a', at: 0, gain: 0.45 }],
  }

  it('places every voice and bed from the beginning', () => {
    expect(placements(score, 0).map(({ after, from }) => [after, from])).toEqual([
      [0, 0],
      [6.3, 0],
      [0, 0],
    ])
  })

  it('joins what is already playing where it would be by now', () => {
    const placed = placements(score, 2)
    expect(placed[0]).toMatchObject({ after: 0, from: 2 })
    expect(placed[1].after).toBeCloseTo(4.3)
    expect(placed[2]).toMatchObject({ after: 0, from: 2, cue: { gain: 0.45 } })
  })
})
