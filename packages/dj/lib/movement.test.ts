import { describe, expect, it } from 'bun:test'
import { movementsOf, openness, rezzy } from '../index.js'

const segments = [
  { ipa: 'h', t0: 0.05, t1: 0.1, kind: 'glottal' },
  { ipa: 'ɛ', t0: 0.1, t1: 0.2, stress: 1, kind: 'vowel' },
  { ipa: 'l', t0: 0.2, t1: 0.26, kind: 'lateral' },
  { ipa: 'ɑ', t0: 0.26, t1: 0.4, stress: 0, kind: 'vowel' },
  { ipa: 'm', t0: 0.4, t1: 0.46, kind: 'nasal' },
]

describe('movementsOf', () => {
  const moves = movementsOf(segments, rezzy.movements)

  it('opens the mouth with the vowels, as wide as they are open, and shuts it on the lips', () => {
    expect(openness('ɑ')).toBeGreaterThan(openness('i'))
    expect(moves.find((m) => m.at === 0.26)!.mouth).toBe(rezzy.movements.mouth)
    expect(moves.at(-1)!.mouth).toBe(0)
  })

  it('bobs on a stressed vowel and not on an unstressed one, and stirs for no breath', () => {
    expect(moves.find((m) => m.at === 0.1)!.bob).toBe(rezzy.movements.bob)
    expect(moves.find((m) => m.at === 0.26)!.bob).toBe(0)
    expect(moves.some((m) => m.at === 0.05)).toBe(false)
  })

  it('lasts at least as long as nothing flickers', () => {
    for (const m of moves) expect(m.seconds).toBeGreaterThanOrEqual(rezzy.movements.least)
  })
})
