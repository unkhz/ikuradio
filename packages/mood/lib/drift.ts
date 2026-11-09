// A Mood never changes all at once. When a new Song begins, its oldest
// description is let go and one new description arrives:
//
//   eternity + chamber music  ->  chamber music + dub  ->  dub + first snow
//
// Each step is small. After enough Songs, the song can be anywhere.

/**
 * Lets the oldest descriptions go and adds new ones until there are `count`
 * of them again. New ones are picked from `pool`, never one that was in
 * the previous Mood. `random` returns a number in [0, 1), like Math.random.
 */
export function drift(
  descriptions: readonly string[],
  pool: readonly string[],
  count: number,
  random: () => number = Math.random,
): string[] {
  const kept = descriptions.slice(Math.max(0, descriptions.length - count + 1))
  const fresh = pool.filter((d) => !descriptions.includes(d))
  while (kept.length < count && fresh.length > 0) {
    const [arrival] = fresh.splice(Math.floor(random() * fresh.length), 1)
    kept.push(arrival)
  }
  return kept
}
