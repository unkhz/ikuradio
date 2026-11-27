// Finnish song-writing primitives: cardinal numbers, chorus opening, Finnish
// rhyme bank for iteration numbers, initial Finnish verses, and imagery tray.

import type { Lyrics } from '../index.js'

const ONES = [
  'nolla',
  'yksi',
  'kaksi',
  'kolme',
  'neljä',
  'viisi',
  'kuusi',
  'seitsemän',
  'kahdeksan',
  'yhdeksän',
] as const

function underThousand(n: number): string {
  if (n === 0) return ''
  if (n < 10) return ONES[n]!
  if (n === 10) return 'kymmenen'
  if (n < 20) return `${ONES[n - 10]!}toista`
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const rem = n % 10
    return `${ONES[tens]!}kymmentä${rem ? ONES[rem]! : ''}`
  }
  const hundreds = Math.floor(n / 100)
  const rem = n % 100
  const prefix = hundreds === 1 ? 'sata' : `${ONES[hundreds]!}sataa`
  return rem ? `${prefix}${underThousand(rem)}` : prefix
}

/** Converts any non-negative integer into Finnish cardinal words, for the chorus's iteration line. */
export function finnishNumberToWords(n: bigint): string {
  if (n === 0n) return 'nolla'
  if (n < 0n) return `miinus ${finnishNumberToWords(-n)}`
  if (n < 1000n) return underThousand(Number(n))

  const parts: string[] = []
  const scales: [bigint, string, string][] = [
    [1_000_000_000_000n, 'biljoona', 'biljoonaa'],
    [1_000_000_000n, 'miljardi', 'miljardia'],
    [1_000_000n, 'miljoona', 'miljoonaa'],
    [1_000n, 'tuhat', 'tuhatta'],
  ]
  let rem = n
  for (const [unit, singular, partitive] of scales) {
    if (rem >= unit) {
      const count = Number(rem / unit)
      rem %= unit
      if (count === 1) parts.push(singular)
      else parts.push(`${underThousand(count)} ${partitive}`)
    }
  }
  if (rem > 0n) parts.push(underThousand(Number(rem)))
  return parts.join(' ')
}

/** First line of a Finnish chorus — always exact, counting how long the song has gone on. */
export function finnishChorusOpening(iteration: bigint): string {
  return `Tämä on laulu, kierros ${finnishNumberToWords(iteration)},`
}

/**
 * Curated Finnish rhyme families keyed by every word a Finnish number can end in.
 * Each entry gives poetic, singable rhyme words and the phonetic tail used for validation.
 */
const NUMBER_RHYMES: { match: string; suffix: string; words: readonly string[] }[] = [
  { match: 'toista', suffix: 'oista', words: ['loistaa', 'toistaa', 'muista', 'poistaa', 'huoistaa'] },
  { match: 'kymmenen', suffix: 'en', words: ['ikuisen', 'hiljainen', 'sydämen', 'tuhannen', 'sävelen', 'kuulen'] },
  { match: 'kymmentä', suffix: 'ä', words: ['hämärää', 'elämää', 'ikävää', 'päivää', 'tätä', 'kestää'] },
  { match: 'seitsemän', suffix: 'än', words: ['elämän', 'hämärän', 'sydämen', 'tämän', 'syvän', 'kestävän'] },
  { match: 'kahdeksan', suffix: 'an', words: ['taivaan', 'kauan', 'laulan', 'rauhan', 'hiljaan', 'aina'] },
  { match: 'yhdeksän', suffix: 'än', words: ['elämän', 'hämärän', 'syvän', 'tämän', 'kestävän', 'yön'] },
  { match: 'yksi', suffix: 'ksi', words: ['uudeksi', 'lauluksi', 'yöksi', 'miksi', 'ikuiseksi', 'syksy'] },
  { match: 'kaksi', suffix: 'ksi', words: ['lauluksi', 'uudeksi', 'yöksi', 'tähdeksi', 'miksi', 'hiljaiseksi'] },
  { match: 'kolme', suffix: 'me', words: ['solme', 'ilme', 'lumme', 'soimme', 'kuljemme', 'laulumme'] },
  { match: 'neljä', suffix: 'ä', words: ['väljä', 'selkä', 'kylmä', 'yhä', 'tyhjä', 'syvä'] },
  { match: 'viisi', suffix: 'iisi', words: ['kiisi', 'hiisi', 'biisi', 'riisi', 'viisi', 'tiivis'] },
  { match: 'kuusi', suffix: 'uusi', words: ['uusi', 'huusi', 'luusi', 'kuusi', 'puusi', 'tuuli'] },
  { match: 'sataa', suffix: 'ataa', words: ['rataa', 'sataa', 'kattaa', 'jatkaa', 'matkaa', 'kantaa'] },
  { match: 'sata', suffix: 'ata', words: ['rata', 'kattaa', 'jatkaa', 'matka', 'rantaa', 'laulaa'] },
  { match: 'tuhatta', suffix: 'a', words: ['uutta', 'muuttaa', 'kattaa', 'jatkaa', 'matka', 'valoa'] },
  { match: 'tuhat', suffix: 'at', words: ['sanat', 'virrat', 'soivat', 'jatkat', 'kuljet', 'laulat'] },
  { match: 'miljoonaa', suffix: 'aa', words: ['laulaa', 'jatkaa', 'loistaa', 'kantaa', 'taivaan', 'aikaa'] },
  { match: 'miljoona', suffix: 'ona', words: ['koko', 'sointuna', 'kotona', 'valona', 'lauluna', 'ilona'] },
  { match: 'nolla', suffix: 'olla', words: ['olla', 'polulla', 'valolla', 'laululla', 'ilolla', 'taivaalla'] },
]

/** Last word of a Finnish line, lowercase, preserving `ä / ö / å`. */
export function finnishLastWord(line: string): string {
  const words = line.toLowerCase().match(/[\p{L}]+/gu)
  return words?.at(-1) ?? ''
}

/** Offers natural Finnish rhyme candidates for the last word of a Finnish chorus opening. */
export function finnishRhymesFor(age: string): { words: readonly string[]; suffix: string } {
  const w = age.toLowerCase()
  for (const entry of NUMBER_RHYMES) {
    if (w.endsWith(entry.match)) {
      return {
        words: entry.words.filter((cand) => cand !== w),
        suffix: entry.suffix,
      }
    }
  }
  return {
    words: ['uusi', 'loistaa', 'jatkuu', 'ikuisen', 'soimaan', 'laulaa'],
    suffix: w.slice(-2),
  }
}

/**
 * Checks whether two Finnish words rhyme (exact 2+ char ending, doubled-vowel
 * tail match like `loistaa / neljätoista`, or matching vowel tail), rejecting
 * identical words.
 */
export function finnishWordsRhyme(a: string, b: string, suffix?: string): boolean {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  if (!x || !y || x === y) return false
  const collapse = (s: string) => s.replace(/([aeiouyäöå])\1+/g, '$1')
  const cx = collapse(x)
  const cy = collapse(y)
  if (suffix) {
    const cs = collapse(suffix)
    if (x.endsWith(suffix) || cx.endsWith(cs)) return true
  }
  if (cx.length >= 2 && cy.length >= 2 && cx.slice(-2) === cy.slice(-2)) return true
  // Loose Finnish vowel assonance on last two vowels
  const vowels = (s: string) => (s.match(/[aeiouyäöå]+/g) ?? []).slice(-2).map(collapse).join('-')
  const vx = vowels(x)
  const vy = vowels(y)
  return Boolean(vx && vx === vy && cx.at(-1) === cy.at(-1))
}

/**
 * Initial Finnish seed lyrics in the spirit of the song that never ends
 * (8–10 syllables per line, ready for Poro to drift from).
 */
export const firstFinnishLyrics: Lyrics = {
  firstVerse: [
    'Tervetuloa yöhön soivaan,',
    'sävel kulkee kauas hiljaa,',
    'kuule kuinka rytmi kantaa,',
    'laulu jatkuu tähtien alla...',
  ].join('\n'),
  secondVerse: [
    'Nuotit tanssii kuun valossa,',
    'virta vie meidät mukanaan,',
    'sydän lyö tässä hiljaisuudessa,',
    'sävel löytää valon uudestaan...',
  ].join('\n'),
  thirdVerse: [
    'Hämärässä kuljemme taas,',
    'kehtolaulu soi loputtomiin,',
    'kuuntele kuinka ääni nousee,',
    'tämä laulu kutsuu sinua niin...',
  ].join('\n'),
  chorus: [
    'Tämä on laulu, kierros yksi,',
    'se jatkuu aina, lauluksi,',
    'jos tahdot ymmärtää tän sävelen,',
    'niin kuule laulu, se on ikuinen...',
  ].join('\n'),
  finalChorus: [
    'Tämä on laulu, pitkä on tie,',
    'älä pelkää, sävel sinut vie,',
    'matka jatkuu läpi sydämen,',
    'niin kuule laulu, se on ikuinen...',
  ].join('\n'),
}

/** Timeless, concrete Finnish imagery words offered in small trays to keep Poro's verses vivid and varied. */
export const finnishVocabulary: readonly string[] = [
  'kaiku', 'kide', 'kipinä', 'hanki', 'sumu', 'virta', 'aalloilla', 'pouta',
  'tuuli', 'kaski', 'hiillos', 'tuhka', 'sarastus', 'hämärä', 'usva', 'kaste',
  'kivi', 'sammaleen', 'juuri', 'oksa', 'lehti', 'pilvi', 'luoto', 'lahti',
  'majakka', 'silta', 'portti', 'polku', 'kynnys', 'ikkuna', 'kello', 'neula',
  'lanka', 'solmu', 'purje', 'airo', 'kompassi', 'lyhty', 'varjo', 'heijastus',
  'revontuli', 'kaamos', 'tunturi', 'kantele', 'sävel', 'sointu', 'kuiskaus', 'humina',
  'taivas', 'tähdet', 'kuu', 'aurinko', 'sade', 'raekuuro', 'jää', 'lumi',
  'kallo', 'rauta', 'kupari', 'lasi', 'hopea', 'suola', 'savi', 'kulta',
]

/** Draws a small random tray of Finnish imagery words, skipping any resting/deep words. */
export function drawFinnishVocabulary({
  count = 6,
  avoid = [],
  random = Math.random,
}: {
  count?: number
  avoid?: readonly string[]
  random?: () => number
} = {}): string[] {
  const skip = new Set(avoid.map((w) => w.toLowerCase()))
  const pool = finnishVocabulary.filter((w) => !skip.has(w))
  const picked: string[] = []
  const copy = [...pool]
  while (picked.length < count && copy.length > 0) {
    const idx = Math.floor(random() * copy.length)
    picked.push(copy.splice(idx, 1)[0]!)
  }
  return picked
}
