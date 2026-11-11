// Words the mind knows well.
//
// The pronouncing dictionary knows a hundred and twenty-six thousand words,
// and many of them are names: shippee, strate, mcqueen. Offered those, the
// mind will rhyme with them, and the chorus will sing them. A word the mind
// knows well is one it reads as a single piece; a name it hardly knows is
// broken into several. So the song asks the mind how it reads each word,
// and keeps only those it reads whole.

import { pieces } from 'tools'

const remembered = new Map<string, boolean>()

/**
 * Which of these words the mind reads whole. Resolves with undefined if the
 * mind cannot say, and then the song does not choose by it.
 */
export async function known(
  words: readonly string[],
  count: (text: string) => Promise<number> = pieces,
): Promise<Set<string> | undefined> {
  try {
    await Promise.all(
      words
        .filter((word) => !remembered.has(word))
        .map(async (word) => remembered.set(word, (await count(` ${word}`)) === 1)),
    )
  } catch {
    return undefined
  }
  return new Set(words.filter((word) => remembered.get(word)))
}
