// Deterministic Finnish syllabification and Chimera IPA articulation.
//
// Finnish orthography is nearly 100% phonemic, so every Finnish word maps
// directly to our Chimera fork's tuned articulatory targets:
//  - True Finnish vowels: open front `æ̞` (ä), mid front rounded `œ` (ö),
//    back `u̠` (u), open back `ɑ` (a), and `e / i / o / y`
//  - Dental voiceless stop `t̪` and anchored dental lateral `l̪`, with full
//    glottal opening and tight 12 ms VOT on `/p t̪ k/` (`aspirated: true, vot: 0.012`)
//    so stops stay crisp without English `[tʰ]` breathiness or `[d]` voicing bleed
//  - Geminate consonants (`rr / ll / tt / pp / kk / ss / nn / mm / hh`) merged
//    into one lengthened onset (`155–175 ms`)
//  - Coda `r` before a consonant (`tur-ma`, `ker-ta`) boosted to `135 ms`, and
//    `l̪` after a voiceless stop coda (`Revontulet leiskuvat`) boosted to `88 ms`
//  - All 18 Finnish diphthongs carried natively on a single note via Chimera's
//    diphthong expansions and `offglideShare` (`0.60` for opening `ie / uo / yö`,
//    `0.42` for closing diphthongs).

import type { PhonemeSegment, PhonemeSyllable, Score, Syllables } from 'melody'

const VOWELS = new Set([...'aeiouyäöå'])

/** All 18 standard Finnish diphthongs. */
const DIPHTHONGS = new Set([
  'ai', 'ei', 'oi', 'ui', 'yi', 'äi', 'öi',
  'au', 'eu', 'iu', 'ou',
  'ey', 'iy', 'äy', 'öy',
  'ie', 'uo', 'yö',
])

/** Finnish diphthong → `[chimeraIpa, offglideShare]`. */
const DIPHTHONG_IPA: Record<string, [string, number | undefined]> = {
  ai: ['ɑi', 0.42],
  au: ['ɑu̠', 0.42],
  ei: ['eɪ', undefined],
  ou: ['ou̠', 0.42],
  oi: ['oi', 0.42],
  // Opening diphthongs: spend ~60% of the note on the more open second half
  ie: ['ie', 0.60],
  uo: ['ʊɔ', 0.60],
  yö: ['yœ', 0.60],
  // Remaining closing/front diphthongs
  äi: ['æ̞i', 0.42],
  öi: ['œi', 0.42],
  ui: ['u̠i', 0.42],
  yi: ['yi', 0.42],
  äy: ['æ̞y', 0.42],
  öy: ['œy', 0.42],
  eu: ['eu̠', 0.42],
  iu: ['iu̠', 0.42],
  ey: ['ey', 0.42],
  iy: ['iy', 0.42],
}

/** Single-vowel Finnish letter → Chimera IPA vowel. */
function singleVowelIpa(ch: string): string {
  switch (ch) {
    case 'a': return 'ɑ'
    case 'ä': return 'æ̞'
    case 'ö': return 'œ'
    case 'å': return 'o'
    case 'u': return 'u̠'
    default: return ch
  }
}

/** Lengthened onset duration (s) for geminate consonants across a syllable boundary. */
const GEMINATE_DUR: Record<string, number> = {
  r: 0.165,
  'l̪': 0.175,
  s: 0.160,
  't̪': 0.155,
  p: 0.155,
  k: 0.155,
  n: 0.155,
  m: 0.155,
  h: 0.155,
}

/** Tight VOT (s) for crisp Finnish voiceless stops `/p t̪ k/`. */
const STOP_VOT = 0.012
const VOICELESS_STOPS = new Set(['p', 't', 't̪', 'k'])

function stopSeg(ipa: string): PhonemeSegment {
  return { ipa, aspirated: true, vot: STOP_VOT }
}

/** Maps a consonant cluster string to Chimera IPA segments. */
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
      out.push({ ipa: 'ŋ' }, stopSeg('k'))
      i += 2
      continue
    }
    if (pair === 'sh') {
      out.push({ ipa: 'ʃ' })
      i += 2
      continue
    }
    const ch = raw[i]!
    if (ch === 'p' || ch === 'k') {
      out.push(stopSeg(ch))
    } else if (ch === 't') {
      out.push(stopSeg('t̪'))
    } else if (ch === 'c' || ch === 'q') {
      out.push(stopSeg('k'))
    } else if (ch === 'x') {
      out.push(stopSeg('k'), { ipa: 's' })
    } else if (ch === 'z') {
      out.push(stopSeg('t̪'), { ipa: 's' })
    } else if (ch === 'l') {
      out.push({ ipa: 'l̪' })
    } else if (ch === 'w') {
      out.push({ ipa: 'v' })
    } else if (ch === 'š') {
      out.push({ ipa: 'ʃ' })
    } else if (ch === 'ž') {
      out.push({ ipa: 'ʒ' })
    } else if (/^[bdfghjmnrsv]$/.test(ch)) {
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

/** Builds per-syllable IPA structures with geminate consolidation, `ng/nk`, coda `r`, and `p/t̪/k → l̪`. */
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
        next.onset[0] = { ipa: 'ŋ', dur: 0.155 }
        continue
      }
      // Finnish `nk` across syllables (`lan-ka`) -> `ŋ` coda + crisp `k` onset
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
      // Coda `r` before a following onset consonant (`tur-ma`, `ker-ta`, `per-he`):
      // give the trill enough room to strike clearly before the next consonant closes.
      if (lastCoda.ipa === 'r' && lastCoda.dur === undefined) {
        lastCoda.dur = 0.135
      }
    }

    // Voiceless stop coda followed by `l̪` onset (`Revontulet leiskuvat`):
    // give `l̪` enough room to survive the stop's release tail.
    if (VOICELESS_STOPS.has(lastCoda.ipa) && firstOnset.ipa === 'l̪' && firstOnset.dur === undefined) {
      next.onset[0] = { ...firstOnset, dur: 0.088 }
    }
  }

  return out
}

/**
 * Attaches deterministic Finnish IPA `syllables` to an already-fitted, already-humanized
 * `Score` / `Take` using Chimera's native Finnish diphthong expansions and `offglideShare`.
 */
export function expandFinnishTake<T extends Score>(take: T, line: string): T {
  const prepared = prepareFinnishLine(line)
  const positiveNotes = take.notes.filter(([midi]) => midi > 0).length
  if (prepared.length === 0 || prepared.length !== positiveNotes) return take

  const syllables: PhonemeSyllable[] = prepared.map((cur) => {
    const nuc = cur.nucleusStr
    const isDiphthong = nuc.length === 2 && nuc[0] !== nuc[1]
    const diph = isDiphthong ? DIPHTHONG_IPA[nuc] : undefined
    const ipa = !nuc ? 'ə' : diph ? diph[0] : singleVowelIpa(nuc[0]!)
    const offglideShare = diph?.[1]
    return {
      text: cur.raw,
      onset: cur.onset,
      nucleus: { ipa, stress: cur.stress },
      coda: cur.coda,
      wordEnd: cur.wordEnd,
      phraseEnd: cur.phraseEnd,
      ...(offglideShare !== undefined ? { offglideShare } : {}),
    }
  })

  return { ...take, syllables }
}
