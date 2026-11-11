// Worn words.
//
// Stone steps wear where everyone treads. A song that writes itself forever
// treads in the same places too: left alone, a mind in a romantic mood will
// sing *love* and *hearts* in every verse, until the words mean nothing.
// So each iteration looks at the words the last one leaned on most, and
// lets them rest. They are not forbidden for ever: the next iteration leans
// on other words, and those rest in turn, and the first ones come back.
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
