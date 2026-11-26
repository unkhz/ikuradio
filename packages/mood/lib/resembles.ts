// Whether two weather descriptions are the same weather in different words.

/** Small words that carry no weather of their own. */
const small = new Set([
  'a',
  'an',
  'the',
  'of',
  'in',
  'on',
  'at',
  'with',
  'and',
  'to',
  'by',
  'for',
  'from',
])

/** The words that make a description what it is, with plurals let go. */
function essence(description: string): Set<string> {
  return new Set(
    description
      .toLowerCase()
      .split(/[^\p{L}\p{N}']+/u)
      .filter((word) => word && !small.has(word))
      .map((word) => word.replace(/'s$/, '').replace(/(?<=\w{3})s$/, '')),
  )
}

/**
 * Whether two descriptions are the same weather in different words: when
 * most of what they are made of is shared, as in "whispers of a distant
 * shore" and "a whisper of distant shores".
 */
export function resembles(a: string, b: string): boolean {
  const x = essence(a)
  const y = essence(b)
  if (x.size === 0 || y.size === 0) return false
  const shared = [...x].filter((word) => y.has(word)).length
  return shared / Math.min(x.size, y.size) >= 0.75
}
