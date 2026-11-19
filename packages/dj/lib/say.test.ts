import { describe, expect, it } from 'bun:test'
import { requestOf, rezzy } from '../index.js'

describe('requestOf', () => {
  it('asks for the text in the DJ\'s voice, hurried by what it is told to', () => {
    expect(requestOf(rezzy, 'Hello.')).toEqual({ text: 'Hello.', body: { female: 0.5, child: 0.05 }, f0: 232, rate: 1.1, accent: 0.2, stretch: [[0, expect.any(Number)]] })
    expect(requestOf(rezzy, 'Hello.', 1.2).rate).toBe(1.32)
  })
})
