// Deterministic Finnish syllabification and Chimera IPA articulation.
//
// Finnish orthography is nearly 100% phonemic, so every Finnish word can be
// mapped directly to Chimera's articulatory vocal tract without a word list:
//  - Unaspirated voiceless stops (`p / t / k` with `aspirated: false`)
//  - Geminate consonants (`rr / ll / tt / pp / kk / ss / nn / mm`) merged into
//    one lengthened onset instead of two colliding segments
//  - Slight `l`-onset duration boost after voiceless stop codas (`t/p/k → l`)
//  - Chimera's 5 native falling diphthongs (`ai/au/ei/ou/oi`) kept single
//  - Opening diphthongs (`ie / uo / yö`) and other Finnish diphthongs
//    (`äi / öi / ui / yi / äy / öy / eu / iu / ey / iy`) split smoothly across
//    the same humanized MIDI note, subtracting upcoming consonant time so both
//    vowels ring out in balance (targeting `ɛ / ɔ / œ` for `ie / uo / yö`).

import type { PhonemeSegment, PhonemeSyllable, Score, Syllables } from 'melody'

const VOWELS = new Set([...'aeiouyäöå'])

/** All 18 standard Finnish diphthongs. */
const DIPHTHONGS = new Set([
  'ai', 'ei', 'oi', 'ui', 'yi', 'äi', 'öi',
  'au', 'eu', 'iu', 'ou',
  'ey', 'iy', 'äy', 'öy',
  'ie', 'uo', 'yö',
])

/** Finnish diphthongs Chimera's planner already expands natively as falling diphthongs. */
const NATIVE_FALLING: Record<string, string> = {
  ai: 'aɪ',
  au: 'aʊ',
  ei: 'eɪ',
  ou: 'oʊ',
  oi: 'ɔɪ',
}

/**
 * Opening diphthongs: Chimera's close-mid female `e / o / ø` sit too close in F1
 * to `i / u / y`, so the second half targets mid-open `ɛ / ɔ / œ` (true Finnish `[e̞ o̞ ø̞]`).
 */
const OPENING_SPLIT: Record<string, [string, string]> = {
  ie: ['i', 'ɛ'],
  uo: ['u', 'ɔ'],
  yö: ['y', 'œ'],
}

/** Single-vowel Finnish letter → Chimera IPA vowel. */
function singleVowelIpa(ch: string): string {
  switch (ch) {
    case 'a': return 'ɑ'
    case 'ä': return 'æ'
    case 'ö': return 'ø'
    case 'å': return 'o'
    default: return ch
  }
}

/** Lengthened onset duration (s) for geminate consonants across a syllable boundary. */
const GEMINATE_DUR: Record<string, number> = {
  r: 0.115,
  l: 0.095,
  s: 0.125,
  t: 0.105,
  p: 0.105,
  k: 0.105,
  n: 0.095,
  m: 0.095,
  h: 0.105,
}

/** Approximate sung duration (s) of a Chimera consonant (matches `sing.rs` `0.8 * def.dur`). */
function estimatedConsonantSec(seg: PhonemeSegment): number {
  if (seg.dur !== undefined) return seg.dur
  switch (seg.ipa) {
    case 'r': return 0.088
    case 's':
    case 'ʃ': return 0.096
    case 'h': return 0.072
    case 'p':
    case 't':
    case 'k': return 0.064
    case 'f':
    case 'v':
    case 'b':
    case 'd':
    case 'g': return 0.058
    case 'm':
    case 'n':
    case 'ŋ':
    case 'l': return 0.055
    case 'j': return 0.044
    default: return 0.06
  }
}

const VOICELESS_STOPS = new Set(['p', 't', 'k'])

/** Maps a consonant cluster string to Chimera IPA segments (unaspirated Finnish stops). */
function consonantsToIpa(raw: string): PhonemeSegment[] {
  const out: PhonemeSegment[] = []
  for (let i = 0; i < raw.length; ) {
    const pair = raw.slice(i, i + 2)
    if (pair === 'ng') {
      out.push({ ipa: 'ŋ' })
      i += 2
      continue
    }
    if (pair === 'nk') {
      out.push({ ipa: 'ŋ' }, { ipa: 'k', aspirated: false })
      i += 2
      continue
    }
    if (pair === 'sh') {
      out.push({ ipa: 'ʃ' })
      i += 2
      continue
    }
    const ch = raw[i]!
    if (ch === 'p' || ch === 't' || ch === 'k') {
      out.push({ ipa: ch, aspirated: false })
    } else if (ch === 'c' || ch === 'q') {
      out.push({ ipa: 'k', aspirated: false })
    } else if (ch === 'x') {
      out.push({ ipa: 'k', aspirated: false }, { ipa: 's' })
    } else if (ch === 'z') {
      out.push({ ipa: 't', aspirated: false }, { ipa: 's' })
    } else if (ch === 'w') {
      out.push({ ipa: 'v' })
    } else if (ch === 'š') {
      out.push({ ipa: 'ʃ' })
    } else if (ch === 'ž') {
      out.push({ ipa: 'ʒ' })
    } else if (/^[bdfghjlmnrsv]$/.test(ch)) {
      out.push({ ipa: ch })
    }
    i++
  }
  return out
}

/** Splits one Finnish word into orthographic syllables. */
export function syllabifyFinnishWord(word: string): string[] {
  const w = word.toLowerCase().replace(/[^a-zäöåšž]/g, '')
  if (!w) return []
  const syls: string[] = []
  let i = 0
  let cur = ''
  while (i < w.length) {
    while (i < w.length && !VOWELS.has(w[i]!)) {
      cur += w[i++]!
    }
    if (i >= w.length) {
      if (syls.length) syls[syls.length - 1] += cur
      else if (cur) syls.push(cur)
      break
    }
    const v1 = w[i++]!
    cur += v1
    if (i < w.length && VOWELS.has(w[i]!)) {
      const v2 = w[i]!
      if (v2 === v1 || DIPHTHONGS.has(v1 + v2)) {
        cur += v2
        i++
      }
    }
    let cEnd = i
    while (cEnd < w.length && !VOWELS.has(w[cEnd]!)) cEnd++
    if (cEnd === w.length) {
      cur += w.slice(i)
      i = cEnd
    } else if (cEnd - i >= 2) {
      cur += w.slice(i, cEnd - 1)
      i = cEnd - 1
    }
    syls.push(cur)
    cur = ''
  }
  return syls
}

type WordToken = {
  syllables: string[]
  stresses: number[]
  comma: boolean
}

/** Tokenizes a Finnish line into words, splitting hyphenated compounds cleanly. */
function tokenizeFinnishLine(line: string): WordToken[] {
  const rawTokens = line
    .replace(/(\p{L})[-–—](\p{L})/gu, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
  const words: WordToken[] = []
  for (const tok of rawTokens) {
    const syllables = syllabifyFinnishWord(tok)
    if (!syllables.length) continue
    const comma = /[,.;:!?…]$/.test(tok)
    // Finnish primary stress always falls on syllable 1; secondary stress on odd non-final syllables
    const stresses = syllables.map((_, idx) =>
      idx === 0 ? 1 : idx % 2 === 0 && idx < syllables.length - 1 ? 2 : 0,
    )
    words.push({ syllables, stresses, comma })
  }
  return words
}

/** Deterministic Finnish syllable count for a line. */
export function countFinnishSyllables(line: string): number {
  return tokenizeFinnishLine(line).reduce((sum, w) => sum + w.syllables.length, 0)
}

/** Finnish words with stress pattern and comma marks, for `fitToCount` and `timedLine`. */
export function finnishStressedLine(line: string): Syllables[] {
  return tokenizeFinnishLine(line).map(({ stresses, comma }) => ({
    stresses,
    ...(comma ? { comma: true } : {}),
  }))
}

type PreparedFinnishSyllable = {
  raw: string
  onset: PhonemeSegment[]
  nucleusStr: string
  coda: PhonemeSegment[]
  stress: number
  wordEnd: boolean
  phraseEnd: boolean
}

/** Builds per-syllable IPA structures with geminate consolidation, `ng/nk`, and `t/p/k → l` protection. */
function prepareFinnishLine(line: string): PreparedFinnishSyllable[] {
  const words = tokenizeFinnishLine(line)
  const out: PreparedFinnishSyllable[] = []
  for (const word of words) {
    word.syllables.forEach((raw, idx) => {
      let i = 0
      while (i < raw.length && !VOWELS.has(raw[i]!)) i++
      const onStr = raw.slice(0, i)
      let j = i
      while (j < raw.length && VOWELS.has(raw[j]!)) j++
      const nucStr = raw.slice(i, j)
      const codStr = raw.slice(j)
      out.push({
        raw,
        onset: consonantsToIpa(onStr),
        nucleusStr: nucStr,
        coda: consonantsToIpa(codStr),
        stress: word.stresses[idx]!,
        wordEnd: idx === word.syllables.length - 1,
        phraseEnd: idx === word.syllables.length - 1 && word.comma,
      })
    })
  }
  if (out.length) out[out.length - 1]!.phraseEnd = true

  // Cross-syllable phonological adjustments
  for (let i = 0; i + 1 < out.length; i++) {
    const prev = out[i]!
    const next = out[i + 1]!
    const lastCoda = prev.coda.at(-1)
    const firstOnset = next.onset[0]
    if (!lastCoda || !firstOnset) continue

    if (!prev.wordEnd) {
      // Finnish `ng` across syllables (`lan-gat`) -> single lengthened velar nasal `ŋ`
      if (lastCoda.ipa === 'n' && firstOnset.ipa === 'g') {
        prev.coda.pop()
        next.onset[0] = { ipa: 'ŋ', dur: 0.11 }
        continue
      }
      // Finnish `nk` across syllables (`lan-ka`) -> `ŋ` coda + unaspirated `k` onset
      if (lastCoda.ipa === 'n' && firstOnset.ipa === 'k') {
        lastCoda.ipa = 'ŋ'
        continue
      }
      // Geminate consonants (`rr`, `ll`, `tt`, `pp`, `kk`, `ss`, `nn`, `mm`, `hh`):
      // merge into one lengthened onset so two full stops/trills don't crush the vowel.
      const gemDur = GEMINATE_DUR[firstOnset.ipa]
      if (lastCoda.ipa === firstOnset.ipa && gemDur !== undefined) {
        prev.coda.pop()
        next.onset[0] = { ...firstOnset, dur: gemDur }
        continue
      }
    }

    // Voiceless stop coda followed by `l` onset (`Revontulet leiskuvat`):
    // give `l` enough room to survive the stop's release tail.
    if (VOICELESS_STOPS.has(lastCoda.ipa) && firstOnset.ipa === 'l' && firstOnset.dur === undefined) {
      next.onset[0] = { ...firstOnset, dur: 0.088 }
    }
  }

  return out
}

/** Splits a diphthong note across `[b1, b2]` with `b1 + b2 === beats` while keeping actual vowel times balanced. */
function splitDiphthongBeats(
  beats: number,
  bpm: number,
  stolenConsSec: number,
  v1Share: number,
): [number, number] {
  const secPerBeat = 60 / bpm
  const totalSec = beats * secPerBeat
  const vowelRoom = Math.max(0.08, totalSec - stolenConsSec)
  const minHalfSec = Math.min(0.055, totalSec * 0.35)
  const v1Sec = Math.min(totalSec - minHalfSec, Math.max(minHalfSec, vowelRoom * v1Share))
  const b1 = Math.round((v1Sec / secPerBeat) * 10000) / 10000
  const b2 = Math.round((beats - b1) * 10000) / 10000
  if (b1 <= 0 || b2 <= 0) {
    const half = Math.round((beats * 0.5) * 10000) / 10000
    return [half, Math.round((beats - half) * 10000) / 10000]
  }
  return [b1, b2]
}

/**
 * Attaches deterministic Finnish IPA `syllables` to an already-fitted, already-humanized
 * `Score` / `Take`, expanding non-native Finnish diphthongs (`ie / uo / yö`, `äi / ui / ...`)
 * cleanly across the same humanized MIDI pitch without altering total duration.
 *
 * Called after `humanize()` and `keepsPace()` so melody writing, choir harmony,
 * humanization, and syllable-rate enforcement all operate on true Finnish syllable counts.
 */
export function expandFinnishTake<T extends Score>(take: T, line: string): T {
  const prepared = prepareFinnishLine(line)
  const positiveNotes = take.notes.filter(([midi]) => midi > 0).length
  if (prepared.length === 0 || prepared.length !== positiveNotes) return take

  const expandedNotes: [number, number][] = []
  const expandedSyllables: PhonemeSyllable[] = []
  let sylIdx = 0

  for (const [midi, beats] of take.notes) {
    if (midi <= 0) {
      expandedNotes.push([midi, beats])
      continue
    }
    const cur = prepared[sylIdx]!
    const next = prepared[sylIdx + 1]
    sylIdx++

    const nuc = cur.nucleusStr
    const isDiphthong = nuc.length === 2 && nuc[0] !== nuc[1]
    const native = isDiphthong ? NATIVE_FALLING[nuc] : undefined

    if (isDiphthong && !native) {
      const opening = OPENING_SPLIT[nuc]
      const [v1, v2] = opening ?? [singleVowelIpa(nuc[0]!), singleVowelIpa(nuc[1]!)]
      const v1Share = opening ? 0.4 : 0.58
      const stolenSec =
        cur.coda.reduce((s, c) => s + estimatedConsonantSec(c), 0) +
        (next && !cur.phraseEnd ? next.onset.reduce((s, c) => s + estimatedConsonantSec(c), 0) : 0)
      const [b1, b2] = splitDiphthongBeats(beats, take.bpm, stolenSec, v1Share)
      expandedNotes.push([midi, b1], [midi, b2])
      expandedSyllables.push(
        {
          text: `${cur.raw}:1`,
          onset: cur.onset,
          nucleus: { ipa: v1, stress: cur.stress },
          coda: [],
          wordEnd: false,
          phraseEnd: false,
        },
        {
          text: `${cur.raw}:2`,
          onset: [],
          nucleus: { ipa: v2, stress: 0 },
          coda: cur.coda,
          wordEnd: cur.wordEnd,
          phraseEnd: cur.phraseEnd,
        },
      )
      continue
    }

    const ipa = !nuc
      ? 'ə'
      : native ?? singleVowelIpa(nuc[0]!)
    expandedNotes.push([midi, beats])
    expandedSyllables.push({
      text: cur.raw,
      onset: cur.onset,
      nucleus: { ipa, stress: cur.stress },
      coda: cur.coda,
      wordEnd: cur.wordEnd,
      phraseEnd: cur.phraseEnd,
    })
  }

  return { ...take, notes: expandedNotes, syllables: expandedSyllables }
}
