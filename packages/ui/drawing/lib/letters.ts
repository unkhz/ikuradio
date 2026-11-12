// Letters for a display of dots: five across and seven down, lowercase,
// the way an old receiver's little panel spells what it is tuned to. Only
// the letters the receiver has needed so far.

const glyphs: Record<string, string> = {
  i: '..#.. ..... .##.. ..#.. ..#.. ..#.. .###.',
  k: '#.... #.... #..#. #.#.. ##... #.#.. #..#.',
  u: '..... ..... #...# #...# #...# #..## .##.#',
  r: '..... ..... #.##. ##..# #.... #.... #....',
  a: '..... ..... .###. ....# .#### #...# .####',
  d: '....# ....# .##.# #..## #...# #...# .####',
  o: '..... ..... .###. #...# #...# #...# .###.',
}

export const lettersAcross = 5
export const lettersDown = 7

/** Which dots are lit to spell a word, row by row, with one dark column between letters. */
export function spell(word: string): boolean[][] {
  const letters = [...word].map((letter) => {
    const glyph = glyphs[letter]
    if (!glyph) throw new Error(`the display has no letter "${letter}"`)
    return glyph.split(' ').map((row) => [...row].map((dot) => dot === '#'))
  })
  return Array.from({ length: lettersDown }, (_, row) =>
    letters.flatMap((letter, i) => [...(i ? [false] : []), ...letter[row]!]),
  )
}
