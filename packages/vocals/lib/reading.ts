// The throat cannot read. It knows words, and passes over everything else in
// silence: a digit, an ampersand, a percent sign. A song that counts its own
// age in words could not say a single number written in digits. "In 2023"
// was sung as "in".
//
// So before a line reaches the throat, it is read aloud, the way a singer
// reads it off the page: numbers in words, years as years, the small signs
// as what they stand for. Only the singing changes. The words on the page
// keep their digits.
//
// The numbers are read by the same counting the chorus uses for its age.

import { numberToWords } from 'song/lib/numbers.js'

const ordinalEndings: Record<string, string> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
}

/** "twenty-one" becomes "twenty-first": only the last word of a number changes. */
export function ordinal(words: string): string {
  return words.replace(/[a-z]+$/, (last) => {
    if (ordinalEndings[last]) return ordinalEndings[last]
    if (last.endsWith('y')) return `${last.slice(0, -1)}ieth`
    return `${last}th`
  })
}

/**
 * A year, the way a year is said: nineteen sixty-nine, twenty twenty-three,
 * two thousand and five, nineteen hundred.
 */
export function year(n: number): string {
  if (n % 1000 === 0) return numberToWords(BigInt(n))
  if (n > 2000 && n < 2010)
    return `two thousand and ${numberToWords(BigInt(n % 100))}`
  const century = numberToWords(BigInt(Math.floor(n / 100)))
  const rest = n % 100
  if (rest === 0) return `${century} hundred`
  return `${century} ${rest < 10 ? `oh ${numberToWords(BigInt(rest))}` : numberToWords(BigInt(rest))}`
}

const digitWords = 'zero one two three four five six seven eight nine'.split(
  ' ',
)

/** Reads a written number: a count, a year, a decimal, or an ordinal. */
function readNumber(whole: string, fraction?: string, suffix?: string) {
  const n = BigInt(whole.replaceAll(',', ''))
  const looksLikeYear =
    !fraction &&
    !suffix &&
    !whole.includes(',') &&
    /^\d{4}$/.test(whole) &&
    n >= 1100n &&
    n < 2100n
  let words = looksLikeYear ? year(Number(n)) : numberToWords(n)
  if (suffix) words = ordinal(words)
  if (fraction) {
    words += ` point ${[...fraction].map((d) => digitWords[Number(d)]).join(' ')}`
  }
  return words
}

const signs: [RegExp, string][] = [
  [/\s*&\s*/g, ' and '],
  [/\s*\+\s*/g, ' plus '],
  [/\s*@\s*/g, ' at '],
]

/** A line read aloud: what the throat cannot read, spelled out in words it can. */
export function readAloud(line: string): string {
  let read = line.replace(
    /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(st|nd|rd|th)?(\s*%)?/g,
    (_, whole: string, fraction?: string, suffix?: string, percent?: string) =>
      readNumber(whole, fraction, suffix) + (percent ? ' percent' : ''),
  )
  for (const [sign, words] of signs) read = read.replace(sign, words)
  return read.replace(/\s{2,}/g, ' ').trim()
}
