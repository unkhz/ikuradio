import { describe, expect, it } from 'bun:test'
import {
  drawFinnishVocabulary,
  finnishChorusOpening,
  finnishLastWord,
  finnishNumberToWords,
  finnishRhymesFor,
  finnishWordsRhyme,
  firstFinnishLyrics,
} from './finnish.js'

describe('Finnish song helpers', () => {
  it('converts numbers to Finnish cardinal words', () => {
    expect(finnishNumberToWords(0n)).toBe('nolla')
    expect(finnishNumberToWords(1n)).toBe('yksi')
    expect(finnishNumberToWords(10n)).toBe('kymmenen')
    expect(finnishNumberToWords(14n)).toBe('neljätoista')
    expect(finnishNumberToWords(42n)).toBe('neljäkymmentäkaksi')
    expect(finnishNumberToWords(106n)).toBe('satakuusi')
    expect(finnishNumberToWords(310n)).toBe('kolmesataakymmenen')
    expect(finnishNumberToWords(1001n)).toBe('tuhat yksi')
    expect(finnishNumberToWords(2345n)).toBe('kaksi tuhatta kolmesataaneljäkymmentäviisi')
  })

  it('formats the Finnish chorus opening and offers valid rhymes for every number ending', () => {
    expect(finnishChorusOpening(14n)).toBe('Tämä on laulu, kierros neljätoista,')
    for (const n of [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n, 14n, 20n, 100n, 106n, 200n, 1000n]) {
      const opening = finnishChorusOpening(n)
      const age = finnishLastWord(opening)
      const offer = finnishRhymesFor(age)
      expect(offer.words.length).toBeGreaterThanOrEqual(4)
      expect(offer.words).not.toContain(age)
      expect(finnishWordsRhyme(offer.words[0]!, age, offer.suffix)).toBe(true)
    }
  })

  it('rejects identical words as rhymes and keeps ä/ö in lastWord', () => {
    expect(finnishLastWord('Kuule ääni yön hämärässä!')).toBe('hämärässä')
    expect(finnishWordsRhyme('loistaa', 'neljätoista', 'oista')).toBe(true)
    expect(finnishWordsRhyme('kuusi', 'kuusi', 'uusi')).toBe(false)
  })

  it('provides 4-line Finnish seed lyrics and draws non-overlapping vocabulary trays', () => {
    for (const part of [
      firstFinnishLyrics.firstVerse,
      firstFinnishLyrics.secondVerse,
      firstFinnishLyrics.thirdVerse,
      firstFinnishLyrics.chorus,
      firstFinnishLyrics.finalChorus,
    ]) {
      expect(part.split('\n')).toHaveLength(4)
    }
    const tray = drawFinnishVocabulary({ count: 5, avoid: ['kaiku', 'hanki'] })
    expect(tray).toHaveLength(5)
    expect(tray).not.toContain('kaiku')
    expect(tray).not.toContain('hanki')
  })
})
