import { describe, expect, it } from 'bun:test'
import { parseDictionary } from './rhyme.js'
import { stressedWords, stressOf } from './stress.js'

const dictionary = parseDictionary(
  ['THIS\tDH IH1 S', 'IS\tIH1 Z', 'THE\tDH AH0', 'SONG\tS AO1 NG', 'ITERATION\tIH2 T ER0 EY1 SH AH0 N', 'TUNE\tT UW1 N'].join('\n'),
)

describe('stressOf', () => {
  it('reads one stress for every vowel, as the dictionary marks it', () => {
    expect(stressOf(['IH2', 'T', 'ER0', 'EY1', 'SH', 'AH0', 'N'])).toEqual([2, 0, 1, 0])
  })
})

describe('stressedWords', () => {
  it('reads each word’s syllables and stress, never leaning on the small words, and notes the commas', () => {
    expect(stressedWords('This is the song, iteration', dictionary)).toEqual([
      { text: 'this', stresses: [0], comma: false },
      { text: 'is', stresses: [0], comma: false },
      { text: 'the', stresses: [0], comma: false },
      { text: 'song', stresses: [1], comma: true },
      { text: 'iteration', stresses: [2, 0, 1, 0], comma: false },
    ])
  })

  it('sings a possessive it only knows by its word as one syllable more, as the throat does', () => {
    expect(stressedWords("the tune's end", dictionary).map(({ stresses }) => stresses)).toEqual([[0], [1, 0], undefined])
  })
})
