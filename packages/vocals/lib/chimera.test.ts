import { describe, it, expect } from 'bun:test'
import { parseRefusal, prepareLyrics } from './chimera.js'

describe('prepareLyrics', () => {
  it('lets hyphenated words apart', () => {
    expect(prepareLyrics('a never-ending flight,')).toBe(
      'a never ending flight,',
    )
  })

  it('reads aloud what the throat cannot read', () => {
    expect(prepareLyrics('In 2023, the 21st night')).toBe(
      'In twenty twenty three, the twenty first night',
    )
  })

  it('keeps everything else', () => {
    expect(prepareLyrics(' twenty-one, and on... ')).toBe(
      'twenty one, and on...',
    )
  })
})

describe('parseRefusal', () => {
  it('reads the syllable count from the throat', () => {
    expect(
      parseRefusal(
        '13 syllables for 1 notes: This is the song i te ra tion four hun dred and twelve',
      ),
    ).toBe(13)
  })

  it('does not mistake other complaints for a count', () => {
    expect(parseRefusal('bpm missing')).toBeUndefined()
  })
})
