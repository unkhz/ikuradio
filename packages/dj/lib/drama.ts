// A DJ draws some words out, for effect. Which words, and how long, is not
// chosen at random each time the words are said: it comes from the words
// themselves, so the Studio, which fits them to the intro's room, and every
// Receiver, which says them, draw out the same words the same way. The DJ's
// own settings say how often and how far (Voice.drama).

/** How a DJ draws words out. */
export type Drama = {
  /** About one word in this many is drawn out, at least one, and never more than `most`. */
  every: number
  most: number
  /** How many times as long the vowels of a drawn-out word are held, from the least to the most. */
  factor: readonly [number, number]
}

/** Words too small to be drawn out: they hold the others together. */
const small = new Set(
  `a an the and or but nor of to in on at by for from with as is am are was were be been it its i me my we us our you your he him his she her they them their this that these those there than then so if not no do does did has have had will would can could shall should may might must o oh`.split(
    /\s+/,
  ),
)

/** A number in [0, 1) from a text, the same for the same text everywhere. */
export function chance(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 12
  return (h >>> 0) / 0x100000000
}

/** The words of a text as the speaking throat counts them, each with whether a pause follows it. */
export function wordsOf(text: string): { word: string; pause: boolean }[] {
  return [...text.matchAll(/([A-Za-z][A-Za-z'-]*)([^\sA-Za-z]*)/g)].map(([, word, after]) => ({
    word: word!.toLowerCase(),
    pause: /[,.;:!?\u2014\u2013]/.test(after!),
  }))
}

/**
 * The words to draw out: `[word, factor]`, the words counted from 0. The
 * words at the end of a phrase, and the longer ones, are likelier; the small
 * words never are.
 */
export function dramaOf(text: string, drama: Drama): [number, number][] {
  const words = wordsOf(text)
  const wanted = Math.min(drama.most, Math.max(1, Math.round(words.length / drama.every)))
  return words
    .map(({ word, pause }, i) => ({ i, word, score: small.has(word) ? -1 : chance(`${text}:${i}`) + (pause ? 0.6 : 0) + (word.length >= 5 ? 0.3 : 0) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, wanted)
    .sort((a, b) => a.i - b.i)
    .map(({ i }): [number, number] => [i, Math.round((drama.factor[0] + (drama.factor[1] - drama.factor[0]) * chance(`factor:${text}:${i}`)) * 100) / 100])
}
