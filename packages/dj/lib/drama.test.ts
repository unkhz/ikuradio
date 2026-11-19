import { describe, expect, it } from 'bun:test'
import { dramaOf, wordsOf, rezzy } from '../index.js'

const text = "Oh, hello! This one is Dawn's Echo: a warm sunset glow, and a cathedral organ humming far down in the stone. Come and sit with it, it's lovely."
const drama = rezzy.voice.drama!

describe('wordsOf', () => {
  it('counts the words as the throat does, and sees where a pause follows', () => {
    const words = wordsOf(text)
    expect(words.slice(0, 3)).toEqual([{ word: 'oh', pause: true }, { word: 'hello', pause: true }, { word: 'this', pause: false }])
    expect(words.find(({ word }) => word === "dawn's")).toBeDefined()
    expect(words.length).toBe(28)
  })
})

describe('dramaOf', () => {
  const drawn = dramaOf(text, drama)

  it('is the same for the same words, everywhere', () => {
    expect(dramaOf(text, drama)).toEqual(drawn)
    expect(dramaOf(`${text} Again.`, drama)).not.toEqual(drawn)
  })

  it('draws out a few words, never a small one, each by a factor in the DJ\'s range', () => {
    const words = wordsOf(text)
    expect(drawn.length).toBeGreaterThanOrEqual(1)
    expect(drawn.length).toBeLessThanOrEqual(drama.most)
    for (const [i, factor] of drawn) {
      expect(['a', 'the', 'and', 'it', 'is', 'of']).not.toContain(words[i]!.word)
      expect(factor).toBeGreaterThanOrEqual(drama.factor[0])
      expect(factor).toBeLessThanOrEqual(drama.factor[1])
    }
  })

  it('draws one out even of a few words, and none of no words', () => {
    expect(dramaOf('Hello there.', drama).length).toBe(1)
    expect(dramaOf('', drama)).toEqual([])
  })
})
