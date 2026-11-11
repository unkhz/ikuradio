import { describe, expect, it } from 'bun:test'
import { placements } from './time.js'

describe('placements', () => {
  const recordings = [
    { id: 'a.m4a', at: 0, kind: 'voice' as const },
    { id: 'b.m4a', at: 6.3, kind: 'voice' as const },
    { id: 'bed.m4a', at: 0, gain: 0.45, kind: 'bed' as const },
  ]

  it('places every voice and bed from the beginning', () => {
    expect(placements(recordings, 0).map(({ after, from }) => [after, from])).toEqual([
      [0, 0],
      [6.3, 0],
      [0, 0],
    ])
  })

  it('leaves out what is already over', () => {
    const over = placements([{ id: 'gone.m4a', at: 0, seconds: 6, kind: 'voice' }], 7)
    expect(over).toEqual([])
  })

  it('joins what is already playing where it would be by now', () => {
    const placed = placements(recordings, 2)
    expect(placed[0]).toMatchObject({ after: 0, from: 2 })
    expect(placed[1].after).toBeCloseTo(4.3)
    expect(placed[2]).toMatchObject({ after: 0, from: 2, recording: { gain: 0.45 } })
  })
})
