// Hybrid IPA syllable resolution for lines containing special words.
//
// Ordinary English lines return `undefined` (no overhead; Chimera runs English
// CMUdict G2P directly). Whenever a line contains one or more rare words from
// `song`'s special lexicon (e.g. `revontuli`, `petrichor`, `syzygy`, `jötunn`,
// `kantele`, `ikuradio`), normal English words are resolved through Chimera's
// own `lyricsToSyllables` WASM call and each special word is spliced in as
// exact verified IPA `PhonemeSyllable[]`.

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import type { PhonemeSyllable } from 'melody'
import { isSpecialWord, specialByWord, type SpecialWord } from 'song'
import { prepareLyrics } from './chimera.js'
import { parseIpaSyllable } from './scat.js'

const throatDir = new URL('../../ui/public/throat/', import.meta.url)

type WasmG2p = (text: string) => PhonemeSyllable[]
let g2pLoader: Promise<WasmG2p> | undefined

async function loadG2p(): Promise<WasmG2p> {
  g2pLoader ??= (async () => {
    const wasm = readFileSync(new URL('chimera.wasm', throatDir))
    const dict = gunzipSync(readFileSync(new URL('cmudict.txt.gz', throatDir))).toString('utf8')
    const mod = await WebAssembly.compile(wasm)
    const inst = await WebAssembly.instantiate(mod, {})
    const x = inst.exports as unknown as {
      memory: WebAssembly.Memory
      chimera_alloc: (n: number) => number
      chimera_free: (p: number, n: number) => void
      chimera_call: (p: number, n: number) => number
      chimera_result_ptr: () => number
      chimera_result_len: () => number
    }
    const enc = new TextEncoder()
    const dec = new TextDecoder()
    const call = (req: unknown) => {
      const bytes = enc.encode(JSON.stringify(req))
      const at = x.chimera_alloc(bytes.length)
      new Uint8Array(x.memory.buffer, at, bytes.length).set(bytes)
      const failed = x.chimera_call(at, bytes.length)
      x.chimera_free(at, bytes.length)
      const ans = JSON.parse(dec.decode(new Uint8Array(x.memory.buffer, x.chimera_result_ptr(), x.chimera_result_len())))
      if (failed) throw new Error(ans.error || JSON.stringify(ans))
      return ans
    }
    call({ fn: 'g2pLoad', text: dict })
    return (text: string) => call({ fn: 'lyricsToSyllables', text }) as PhonemeSyllable[]
  })()
  return g2pLoader
}

function cleanWord(token: string): string {
  return token.toLowerCase().replace(/[^\p{L}']/gu, '')
}

function lookupSpecial(token: string): { entry: SpecialWord; possessive: boolean } | undefined {
  const clean = cleanWord(token)
  if (!clean) return undefined
  const direct = specialByWord.get(clean)
  if (direct) return { entry: direct, possessive: false }
  if (clean.endsWith("'s")) {
    const stem = specialByWord.get(clean.slice(0, -2))
    if (stem) return { entry: stem, possessive: true }
  }
  return undefined
}

/** True if `line` contains at least one special word needing explicit IPA syllables. */
export function hasSpecialWord(line: string): boolean {
  for (const token of prepareLyrics(line).split(/\s+/)) {
    if (lookupSpecial(token)) return true
  }
  return false
}

/** Builds Chimera `PhonemeSyllable[]` for one special word entry (and optional possessive `'s`). */
export function specialWordSyllables(entry: SpecialWord, opts: { phraseEnd?: boolean; possessive?: boolean } = {}): PhonemeSyllable[] {
  const count = entry.ipa.length
  const out = entry.ipa.map((ipa, i) => {
    const isLast = i === count - 1 && !opts.possessive
    return parseIpaSyllable(ipa, {
      stress: entry.stresses[i] ?? 0,
      wordEnd: isLast,
      phraseEnd: isLast && Boolean(opts.phraseEnd),
    })
  })
  if (opts.possessive) {
    out.push({
      text: "'s",
      onset: [],
      nucleus: { ipa: 'ɪ', stress: 0 },
      coda: [{ ipa: 'z' }],
      wordEnd: true,
      phraseEnd: Boolean(opts.phraseEnd),
    })
  }
  return out
}

/**
 * Resolves explicit IPA `PhonemeSyllable[]` for a line containing one or more
 * special words, splicing Chimera's own English G2P for ordinary words beside
 * our curated IPA for special words. Returns `undefined` for ordinary lines.
 */
export async function resolveLineSyllables(line: string): Promise<PhonemeSyllable[] | undefined> {
  if (!hasSpecialWord(line)) return undefined
  const lyrics = prepareLyrics(line)
  const g2p = await loadG2p()
  const tokens = lyrics.split(/\s+/).filter(Boolean)
  const out: PhonemeSyllable[] = []

  // Batch consecutive ordinary English tokens so Chimera preserves English punctuation/context cleanly
  let englishRun: string[] = []
  const flushEnglish = () => {
    if (!englishRun.length) return
    const text = englishRun.join(' ')
    englishRun = []
    if (!isSpecialWord(text)) out.push(...g2p(text))
  }

  for (const token of tokens) {
    const found = lookupSpecial(token)
    if (found) {
      flushEnglish()
      const phraseEnd = /[,.;:!?—–]$/.test(token)
      out.push(...specialWordSyllables(found.entry, { phraseEnd, possessive: found.possessive }))
    } else {
      englishRun.push(token)
    }
  }
  flushEnglish()

  return out.length ? out : undefined
}
