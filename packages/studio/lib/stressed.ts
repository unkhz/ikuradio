// A line's words with their stress, as the throat will sing them, for the
// bar fit: from the throat's dictionary, and, for a word the dictionary does
// not know, from the throat itself, with the weight on its first syllable.
// They must add up to the syllables the throat counts in the whole line; if
// they do not, the line is fitted the old way, without stress, and nothing
// is guessed.

import type { Syllables } from 'melody'
import { stresses, type StressedWord } from 'song'
import { countSyllables, prepareLyrics } from 'vocals'

export async function stressedLine(
  line: string,
  syllables: number,
  {
    read = stresses,
    count = countSyllables,
  }: { read?: (lyrics: string) => Promise<StressedWord[]>; count?: (word: string) => Promise<number> } = {},
): Promise<Syllables[] | undefined> {
  const words = await read(prepareLyrics(line)).catch(() => undefined)
  if (!words) return undefined
  const known: Syllables[] = []
  for (const word of words) {
    let marks = word.stresses
    if (!marks) {
      const many = await count(word.text).catch(() => 0)
      if (many < 1) return undefined
      marks = Array.from({ length: many }, (_, i) => (i === 0 ? 1 : 0))
    }
    known.push({ stresses: marks, comma: word.comma })
  }
  const counted = known.reduce((sum, word) => sum + word.stresses.length, 0)
  return counted === syllables ? known : undefined
}
