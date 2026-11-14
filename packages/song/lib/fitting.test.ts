import { describe, expect, it, mock } from 'bun:test'

// the mind, as scripted as a mind can be: it answers with the verses it is given, in turn
let answers: string[][] = []
let asked: string[] = []
mock.module('./mind.js', () => ({
  askVerse: async (instruction: string) => {
    asked.push(instruction)
    return answers.shift() ?? ['the same old words are sung', 'the same old words are sung', 'the same old words are sung', 'the same old words are sung']
  },
}))
const { countInstruction, NoVerseFits, writeVerse } = await import('../index.js')
const { forgotten } = await import('./memories.js')

// a line fits its bars if it has at most six words, takes a bar of grace up to eight, and is refused beyond
const fitting = {
  verse: [0, 1, 2, 3].map(() => ({ target: 9, most: 12 })),
  chorus: [0, 1, 2, 3].map(() => ({ target: 9, most: 12 })),
  check: async (_part: 'verse' | 'chorus', _line: number, text: string) => {
    const words = text.split(/\s+/).length
    return words <= 6 ? ('fits' as const) : words <= 8 ? ('grace' as const) : ('refused' as const)
  },
}
// marks without digits: a word that mixes letters and numbers is of this age, and never sung
const letters = (n: number) => [...String(n)].map((d) => 'abcdefghij'[Number(d)]).join('')
const verse = (words: number, mark: string) =>
  [0, 1, 2, 3].map((i) => [`${mark.replace(/\d+/g, (n) => letters(Number(n)))}${'abcd'[i]}`, ...Array.from({ length: words - 1 }, () => 'quietly')].join(' '))
const old = verse(5, 'old').join('\n')

describe('countInstruction', () => {
  it('tells the mind each line’s count, and its ceiling', () => {
    const counts = [{ target: 9, most: 12 }, { target: 10, most: 12 }, { target: 9, most: 11 }, { target: 9, most: 12 }]
    expect(countInstruction(counts)).toBe(
      'Count the syllables: the first line has about 9, and never more than 12; the second line has about 10, and never more than 12; the third line has about 9, and never more than 11; the fourth line has about 9, and never more than 12.',
    )
    expect(countInstruction(counts, [1, 2, 3])).toStartWith('Count the syllables: the second line has about 10')
    expect(countInstruction(undefined)).toBe('Each line has between eight and fourteen syllables.')
  })
})

describe('writeVerse, written to its count', () => {
  it('takes the first verse whose lines all fit their bars, and tells the mind the counts', async () => {
    answers = [verse(9, 'long'), verse(6, 'new')]
    asked = []
    expect(await writeVerse(old, ['snow'], [], forgotten, undefined, [], fitting)).toBe(verse(6, 'new').join('\n'))
    expect(asked[0]).toContain('never more than 12')
  })

  it('allows a bar of grace only when the mind keeps missing', async () => {
    answers = [...Array.from({ length: 8 }, (_, i) => verse(7, `near${i}`)), verse(7, 'graced')]
    expect(await writeVerse(old, ['snow'], [], forgotten, undefined, [], fitting)).toBe(verse(7, 'graced').join('\n'))
  })

  it('sings the old verse again if nothing new fits, and it still does', async () => {
    answers = Array.from({ length: 20 }, (_, i) => verse(10, `far${i}`))
    expect(await writeVerse(old, ['snow'], [], forgotten, undefined, [], fitting)).toBe(old)
  })

  it('sings nothing, and lets the iteration be made again, if not even the old verse fits', async () => {
    answers = Array.from({ length: 20 }, (_, i) => verse(10, `far${i}`))
    const longOld = verse(10, 'old').join('\n')
    await expect(writeVerse(longOld, ['snow'], [], forgotten, undefined, [], fitting)).rejects.toBeInstanceOf(NoVerseFits)
  })
})
