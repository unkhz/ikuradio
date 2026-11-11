import { describe, expect, it } from 'bun:test'
import { typingMoments } from './typing.js'

describe('typingMoments', () => {
  it('never lets a character overtake its neighbour', () => {
    for (let i = 0; i < 100; i++) {
      const moments = typingMoments(
        'a song, that never ends, and on',
        4,
        `${i}`,
      )
      moments.slice(1).forEach((m, k) => expect(m).toBeGreaterThan(moments[k]))
    }
  })

  it('waits longer after a comma', () => {
    const [a, comma, b] = typingMoments('a,b', 1, 'x')
    expect(b - comma).toBeGreaterThan(5 * (comma - a))
  })

  it('ends the line when the voice ends', () => {
    expect(typingMoments('la la', 3, 'x').at(-1)).toBe(3000)
  })
})
