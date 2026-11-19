import { describe, expect, it } from 'bun:test'
import { speakingInstruction, spokenPlainly } from './speeches.js'

describe('speakingInstruction', () => {
  it('tells the DJ, the Song, its weather and how few words', () => {
    const text = speakingInstruction('Rezzy is a critter.', 'A thaw, slow', ['snow', 'gears'], 20)
    expect(text).toContain('Rezzy is a critter.')
    expect(text).toContain('"A thaw, slow"')
    expect(text).toContain('snow and gears')
    expect(text).toContain('At most 20 words')
  })
})

describe('spokenPlainly', () => {
  it('leaves plain words, and takes out what the throat cannot say', () => {
    expect(spokenPlainly('"Hello there, friend!" *waves* 🐾 It\'s 3 am.')).toBe("Hello there, friend! waves It's am.")
  })
})
