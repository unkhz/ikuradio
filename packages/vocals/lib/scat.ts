// Explicit IPA scat syllables for Chimera's vocal tract.
//
// Rather than feeding English-spelled nonsense through CMUdict (where "ba" can
// turn into two-syllable "B.A." and vowels collapse into flat American defaults),
// scat palettes are authored directly in IPA using Chimera's full physical vocal
// tract inventory: bilabial & alveolar trills (ʙ, r, ʀ), taps (ɾ), lateral
// fricatives (ɬ, ɮ), uvular scrapes (q, χ, ʁ), glottal pops (ʔ), palatal
// glides/nasals (ɲ, ʎ, ɥ), rounded front vowels (y, ø, œ), and crisp affricates
// (pf, ts, dz, tʃ, dʒ, tɕ, dʑ).

import type { PhonemeSegment, PhonemeSyllable } from 'melody'

/** Two-character diphthongs Chimera's planner expands natively (longest-match first). */
const diphthongs = ['aɪ', 'aʊ', 'eɪ', 'oʊ', 'ɔɪ'] as const

/** Monophthong vowel targets in Chimera's vocal tract inventory. */
const monophthongs = new Set([
  'a', 'e', 'i', 'o', 'u', 'y', 'æ', 'ø', 'œ',
  'ɐ', 'ɑ', 'ɒ', 'ɔ', 'ə', 'ɛ', 'ɝ', 'ɤ', 'ɨ', 'ɪ', 'ɯ', 'ʊ', 'ʌ',
])

/** Bright/high front vowels favored near melodic peaks. */
const brightVowels = new Set(['i', 'ɪ', 'y', 'e', 'ɛ', 'ø', 'æ', 'aɪ', 'eɪ', 'ɔɪ'])

/** Deep/back rounded vowels favored near melodic troughs. */
const darkVowels = new Set(['u', 'ʊ', 'o', 'ɔ', 'ɒ', 'ɑ', 'œ', 'ɤ', 'ɯ', 'oʊ', 'aʊ'])

/** Two-character affricates in Chimera's consonant inventory (longest-match first). */
const affricates = ['ts', 'dz', 'tʃ', 'dʒ', 'tɕ', 'dʑ', 'tʂ', 'dʐ', 'pf'] as const

/** Single-character consonants in Chimera's consonant inventory. */
const consonants = new Set([
  'p', 'b', 't', 'd', 'ʈ', 'ɖ', 'c', 'ɟ', 'k', 'g', 'q', 'ɢ', 'ʔ',
  'm', 'ɱ', 'n', 'ɳ', 'ɲ', 'ŋ', 'ɴ',
  'ɸ', 'β', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'ʂ', 'ʐ', 'ç', 'ʝ', 'x', 'ɣ', 'χ', 'ʁ', 'ħ', 'ʕ', 'h', 'ɦ',
  'ɬ', 'ɮ', 'w', 'ʋ', 'ɹ', 'ɻ', 'j', 'ɥ', 'ɰ', 'l', 'ɫ', 'ɭ', 'ʎ', 'ɾ', 'ɽ', 'r', 'ʀ', 'ʙ',
])

/** Sonorant codas that ring cleanly on sustained notes. */
const resonantCodas = new Set(['m', 'n', 'ŋ', 'ɲ', 'l', 'ʎ', 'r', 'ʀ', 'ɾ', 'j', 'w'])

/** Percussive/plosive/trill onsets that pop on short snappy notes. */
const percussiveOnsets = new Set(['p', 'b', 't', 'd', 'k', 'g', 'q', 'ʔ', 'ts', 'dz', 'tʃ', 'dʒ', 'tɕ', 'dʑ', 'pf', 'ʙ', 'r', 'ʀ', 'ɾ'])

export type ParsedIpaToken = {
  text: string
  onset: string[]
  nucleus: string
  long: boolean
  coda: string[]
}

/**
 * Parses one compact IPA syllable token (e.g. `ʙo`, `skɾæ`, `tɬi`, `ʁɑːm`, `dʒoɪ`)
 * into Chimera-verified onset, nucleus, and coda IPA symbols.
 * Throws if the token contains unknown IPA symbols or does not have exactly one vowel nucleus.
 */
export function parseIpaToken(raw: string): ParsedIpaToken {
  const token = raw.trim()
  if (!token) throw new Error('empty IPA scat token')

  const onset: string[] = []
  let nucleus: string | undefined
  let long = false
  const coda: string[] = []

  let i = 0
  while (i < token.length) {
    const rest = token.slice(i)

    // Vowel nucleus (only one per syllable)
    if (nucleus === undefined) {
      const diph = diphthongs.find((d) => rest.startsWith(d))
      if (diph) {
        nucleus = diph
        i += diph.length
        if (token[i] === 'ː') {
          long = true
          i++
        }
        continue
      }
      if (monophthongs.has(token[i]!)) {
        nucleus = token[i]!
        i++
        if (token[i] === 'ː') {
          long = true
          i++
        }
        continue
      }
    }

    // Consonant (affricate first, then single symbol)
    const aff = affricates.find((a) => rest.startsWith(a))
    if (aff) {
      ;(nucleus === undefined ? onset : coda).push(aff)
      i += aff.length
      continue
    }
    if (consonants.has(token[i]!)) {
      ;(nucleus === undefined ? onset : coda).push(token[i]!)
      i++
      continue
    }

    throw new Error(`unsupported IPA symbol "${token[i]}" in scat token "${raw}"`)
  }

  if (!nucleus) throw new Error(`no vowel nucleus in IPA scat token "${raw}"`)
  return { text: token, onset, nucleus, long, coda }
}

/** True when `raw` is a valid single-syllable IPA token in Chimera's inventory. */
export function isIpaScatToken(raw: string): boolean {
  try {
    parseIpaToken(raw)
    return true
  } catch {
    return false
  }
}

/** Builds a Chimera `PhonemeSyllable` from one IPA scat token. */
export function parseIpaSyllable(
  raw: string,
  opts: { stress?: number; phraseEnd?: boolean; wordEnd?: boolean; longVowel?: boolean } = {},
): PhonemeSyllable {
  const parsed = parseIpaToken(raw)
  const long = opts.longVowel || parsed.long
  const nucleus: PhonemeSegment = {
    ipa: parsed.nucleus,
    stress: opts.stress ?? 0,
    ...(long ? { dur: 0.24 } : {}),
  }
  return {
    text: parsed.text,
    onset: parsed.onset.map((ipa) => ({ ipa })),
    nucleus,
    coda: parsed.coda.map((ipa) => ({ ipa })),
    wordEnd: opts.wordEnd ?? true,
    phraseEnd: opts.phraseEnd ?? false,
  }
}

/**
 * Composes a lively, musically phrased IPA scat sequence over a bridge's actual
 * `[midi, beats]` melody:
 * - Never repeats the exact same syllable twice in a row (when palette has > 1 token).
 * - Uses melodic pitch contour to lean toward brighter vowels on high notes and
 *   darker vowels on low notes.
 * - Uses note duration to favor punchy stops/trills on short notes and open or
 *   resonant-coda syllables on long held notes.
 * - Occasionally weaves playful 2–3-note rhythmic motifs (`A B C ... A B D`) so
 *   the scat feels alive and intentional rather than pure white noise.
 * - Marks downbeats/peaks with primary stress (`1`) and notes before rests or at
 *   cadence with `phraseEnd: true`.
 */
export function composeScat(
  tokens: readonly string[],
  notes: readonly (readonly [number, number])[],
  random: () => number,
): { lyrics: string; syllables: PhonemeSyllable[] } {
  const palette = tokens.map(parseIpaToken)
  if (!palette.length) throw new Error('composeScat requires at least one IPA token')

  const sounding = notes
    .map(([midi, beats], idx) => ({ midi, beats, idx }))
    .filter(({ midi }) => midi > 0)

  if (!sounding.length) return { lyrics: '', syllables: [] }

  const midis = sounding.map((n) => n.midi)
  const minMidi = Math.min(...midis)
  const maxMidi = Math.max(...midis)
  const span = Math.max(1, maxMidi - minMidi)

  // Weighted pick biased by melodic register and rhythmic role, avoiding immediate repeats
  const pickFor = (
    midi: number,
    beats: number,
    prevText: string | undefined,
    isFinal: boolean,
  ): ParsedIpaToken => {
    const pool = palette.length > 1 ? palette.filter((p) => p.text !== prevText) : palette
    const height = (midi - minMidi) / span // 0 = lowest, 1 = highest
    const isShort = beats <= 0.55
    const isLong = beats >= 1.4 || isFinal

    const weights = pool.map((p) => {
      let w = 1
      if (height >= 0.65 && brightVowels.has(p.nucleus)) w *= 1.9
      if (height <= 0.35 && darkVowels.has(p.nucleus)) w *= 1.9
      if (isShort && p.onset.some((c) => percussiveOnsets.has(c))) w *= 1.75
      if (isLong && (p.coda.length === 0 || p.coda.every((c) => resonantCodas.has(c)))) w *= 2.1
      if (isLong && p.coda.some((c) => !resonantCodas.has(c))) w *= 0.5
      return w
    })
    const total = weights.reduce((a, b) => a + b, 0)
    let target = random() * total
    for (let i = 0; i < pool.length; i++) {
      target -= weights[i]!
      if (target <= 0) return pool[i]!
    }
    return pool.at(-1)!
  }

  // Decide whether to weave a playful motif (call-and-response or bounce) on this bridge
  const useMotif = palette.length >= 3 && sounding.length >= 6 && random() < 0.55
  const motifLen = random() < 0.5 ? 2 : 3
  const chosen: ParsedIpaToken[] = []

  for (let i = 0; i < sounding.length; i++) {
    const { midi, beats, idx } = sounding[i]!
    const prev = chosen.at(-1)?.text
    const isFinal = i === sounding.length - 1

    // Echo the opening motif once a few notes later, mutating its tail so it feels alive
    if (
      useMotif &&
      i >= motifLen + 1 &&
      i < motifLen * 2 &&
      !isFinal &&
      chosen[i - motifLen - 1] &&
      chosen[i - motifLen - 1]!.text !== prev &&
      random() < 0.72
    ) {
      chosen.push(chosen[i - motifLen - 1]!)
      continue
    }

    chosen.push(pickFor(midi, beats, prev, isFinal))
  }

  let beatCursor = 0
  const beatAtIdx = new Map<number, number>()
  for (let i = 0; i < notes.length; i++) {
    beatAtIdx.set(i, beatCursor)
    beatCursor += notes[i]![1]
  }

  const syllables: PhonemeSyllable[] = chosen.map((tok, i) => {
    const cur = sounding[i]!
    const nextRaw = notes[cur.idx + 1]
    const beforeRest = nextRaw !== undefined && nextRaw[0] <= 0
    const isFinal = i === sounding.length - 1
    const beatPos = beatAtIdx.get(cur.idx) ?? 0
    const onDownbeat = Math.abs(beatPos % 2) < 0.05 || Math.abs((beatPos % 2) - 2) < 0.05
    const isPeak = cur.midi >= maxMidi - 1
    const stress = onDownbeat || isPeak || cur.beats >= 1.5 ? 1 : 0
    return {
      text: tok.text,
      onset: tok.onset.map((ipa) => ({ ipa })),
      nucleus: {
        ipa: tok.nucleus,
        stress,
        ...(tok.long || (cur.beats >= 1.75 && isFinal) ? { dur: 0.24 } : {}),
      },
      coda: tok.coda.map((ipa) => ({ ipa })),
      wordEnd: true,
      phraseEnd: isFinal || beforeRest,
    }
  })

  return {
    lyrics: chosen.map((t) => t.text).join(' '),
    syllables,
  }
}
