// Worn words.
//
// Stone steps wear where everyone treads. A song that writes itself forever
// treads in the same places too: left alone, a mind in a romantic mood will
// sing *love* and *hearts* in every verse, until the words mean nothing.
// So each iteration looks at the words the last one leaned on most, and
// lets them rest. They are not forbidden for ever: the next iteration leans
// on other words, and those rest in turn, and the first ones come back.
//
// And some words wear deeper than one iteration can rest them. Over a few
// hundred iterations the song came to sing *echo* in almost every one of
// them, and *halls* and *whispers* in most, whatever the weather: rested
// for one iteration, they came straight back in the next. So the song also
// looks further back, a day or so of singing, and lets rest the words that
// were in more than half of it, until they are not. They come back too,
// only more slowly.
//
// The words of the Mood are never rested. They are the weather, and the
// song is meant to live in it.

/** Words too small to wear: they hold the others together. */
const small = new Set(
  `the and with from into through that this these those there their them they
  what when where which while will would could should shall have has had been
  being were was are our ours your yours you we us his her its it's for not
  nor but yet all any each every some such than then too very just like upon
  over under onto only also even ever once more most much many still here
  let's we're you're i'm it's that's there's who whose whom why how`.split(/\s+/),
)

/** The words of a verse as they are sung, small ones left out. */
function wordsOf(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']+/g) ?? [])
    .map((word) => word.replace(/'s$/, '').replace(/^'+|'+$/g, ''))
    .filter((word) => word.length > 3 && !small.has(word))
}

/**
 * A word with its endings taken off, so that echoes, echoed and echoing are
 * worn as one word. Roughly: it only has to hear the song's own words.
 */
export function stemOf(word: string): string {
  if (word.endsWith('ss')) return word
  if (word.endsWith('ing') && word.length >= 7) return word.slice(0, -3)
  if (word.endsWith('ed') && word.length >= 6) return word.slice(0, -2)
  if (/(?:o|s|x|z|ch|sh)es$/.test(word) && word.length >= 6) return word.slice(0, -2)
  if (word.endsWith('s') && word.length >= 5) return word.slice(0, -1)
  return word
}

/** How far back the song looks for words worn deep: about a day of singing. */
export const longWear = 24

/**
 * The words worn deep: those in more than `share` of the `iterations`
 * (each the verses of one iteration), as stems, at most `count`, the
 * deepest first. Fewer than `least` iterations are too few to tell a habit
 * from a weather. The Mood's own words are never among them.
 */
export function wornDeep(
  iterations: readonly (readonly string[])[],
  mood: readonly string[],
  { share = 0.5, count = 6, least = 8 }: { share?: number; count?: number; least?: number } = {},
): string[] {
  if (iterations.length < least) return []
  const weather = new Set(mood.flatMap(wordsOf).map(stemOf))
  const seen = new Map<string, number>()
  for (const verses of iterations) {
    for (const stem of new Set(verses.flatMap(wordsOf).map(stemOf))) {
      if (!weather.has(stem)) seen.set(stem, (seen.get(stem) ?? 0) + 1)
    }
  }
  return [...seen]
    .filter(([, n]) => n / iterations.length > share)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, count)
    .map(([stem]) => stem)
}

/** How many of the words worn deep a verse uses anyway, in any of their forms. */
export function leansDeep(lines: readonly string[], deep: readonly string[]) {
  const rest = new Set(deep)
  return wordsOf(lines.join(' ')).filter((word) => rest.has(stemOf(word))).length
}

/**
 * The words the verses leaned on most, at most `count`, used at least twice,
 * the most worn first. The Mood's own words are never among them.
 */
export function worn(
  verses: readonly string[],
  mood: readonly string[],
  count = 6,
): string[] {
  const weather = new Set(mood.flatMap(wordsOf))
  const uses = new Map<string, number>()
  for (const word of verses.flatMap(wordsOf)) {
    // violins are still the weather when the Mood says violin
    if (weather.has(word) || weather.has(word.replace(/e?s$/, ''))) continue
    uses.set(word, (uses.get(word) ?? 0) + 1)
  }
  return [...uses]
    .filter(([, n]) => n >= 2)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, count)
    .map(([word]) => word)
}

/** How many of the resting words a verse uses anyway. */
export function leansOn(lines: readonly string[], resting: readonly string[]) {
  const rest = new Set(resting)
  return wordsOf(lines.join(' ')).filter((word) => rest.has(word)).length
}

/**
 * How much of a line, all but its last word, was already in another line:
 * from 0, nothing, to 1, all of it. A line that keeps the shape of the one
 * before and only finds a new rhyme for it is mostly the line before.
 */
export function overlap(line: string, before: string): number {
  // every word counts here, the small ones most: they are the shape
  const body = (text: string) =>
    (text.toLowerCase().match(/[a-z']+/g) ?? []).slice(0, -1)
  const ours = body(line)
  if (ours.length === 0) return 0
  const theirs = new Set(body(before))
  return ours.filter((word) => theirs.has(word)).length / ours.length
}
