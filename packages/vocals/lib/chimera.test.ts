import { parseRefusal, prepareLyrics } from './chimera.js'

describe('prepareLyrics', () => {
  it('lets hyphenated words apart', () => {
    expect(prepareLyrics('a never-ending flight,')).toBe(
      'a never ending flight,',
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
