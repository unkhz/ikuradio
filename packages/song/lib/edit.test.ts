import { describe, it, expect } from 'bun:test'
import { clean, echoes } from './edit.js'

describe('clean', () => {
  it('lets go of what a small mind leaves in a verse that does not belong in a song', () => {
    expect(clean("Yes, it goes on and on, it's just **knew**")).toBe(
      "Yes, it goes on and on, it's just knew",
    )
    expect(clean('## *A* line with `code`<br>')).toBe('A line with code')
  })

  it('keeps the words themselves', () => {
    expect(clean("don't stop, it's not_over")).toBe("don't stop, it's not_over")
  })
})

describe('echoes', () => {
  const verse = [
    "In the mirror ball's kaleidoscope, we twirl,",
    'As the funky bassline steers our world.',
    "With every violin's wail, we're drawn closer,",
    "Our bodies entwined, in the cosmic disco's poser.",
  ]

  it('hears a verse handed back with its punctuation moved', () => {
    expect(echoes(verse.map((line) => line.replace(/[,.]$/, '')), verse)).toBe(true)
  })

  it('lets a verse keep a line or two of the one before', () => {
    expect(
      echoes(
        [verse[0], verse[1], 'Cellos whisper secrets in the dark,', 'Our hearts beat on, a single spark.'],
        verse,
      ),
    ).toBe(false)
  })
})

describe('clean, at the start of a line', () => {
  it('lets no line begin with punctuation', () => {
    expect(clean(":In the mirror ball's kaleidoscope")).toBe("In the mirror ball's kaleidoscope")
  })
})
