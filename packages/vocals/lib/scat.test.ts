import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { wrongness } from 'melody'
import { composeScat, isIpaScatToken, parseIpaSyllable, parseIpaToken } from './scat.js'

const page = new URL('../../ui/public/', import.meta.url).pathname
const promptsPath = new URL('../../perspectives/bridge-scat/prompts.json', import.meta.url).pathname

describe('IPA scat parser and composer', () => {
  it('parses affricates, diphthongs, long vowels, and exotic Chimera IPA tokens', () => {
    expect(parseIpaToken('ʙo')).toEqual({ text: 'ʙo', onset: ['ʙ'], nucleus: 'o', long: false, coda: [] })
    expect(parseIpaToken('dʒɔɪ')).toEqual({ text: 'dʒɔɪ', onset: ['dʒ'], nucleus: 'ɔɪ', long: false, coda: [] })
    expect(parseIpaToken('ʁɑːm')).toEqual({ text: 'ʁɑːm', onset: ['ʁ'], nucleus: 'ɑ', long: true, coda: ['m'] })
    expect(parseIpaToken('skɾæ')).toEqual({ text: 'skɾæ', onset: ['s', 'k', 'ɾ'], nucleus: 'æ', long: false, coda: [] })
    expect(parseIpaSyllable('ʁɑːm', { stress: 1, phraseEnd: true })).toEqual({
      text: 'ʁɑːm',
      onset: [{ ipa: 'ʁ' }],
      nucleus: { ipa: 'ɑ', stress: 1, dur: 0.24 },
      coda: [{ ipa: 'm' }],
      wordEnd: true,
      phraseEnd: true,
    })
  })

  it('rejects empty tokens, vowelless tokens, and unknown IPA symbols', () => {
    expect(isIpaScatToken('')).toBe(false)
    expect(isIpaScatToken('ptk')).toBe(false)
    expect(isIpaScatToken('doo')).toBe(false) // second 'o' is not a coda consonant
    expect(() => parseIpaToken('ba!')).toThrow()
  })

  it('composes deterministic, non-repeating, musically stressed IPA syllables matching sounding notes', () => {
    const notes: [number, number][] = [
      [60, 0.5], [64, 0.5], [67, 0.5], [72, 1], [67, 0.5], [64, 0.5], [60, 2], [0, 1],
      [62, 0.5], [65, 0.5], [69, 1], [64, 2],
    ]
    const palette = ['ʙo', 'pfa', 'tɾi', 'kø', 'ʙu', 'tsak']
    const a = composeScat(palette, notes, wrongness('scat:test:1'))
    const b = composeScat(palette, notes, wrongness('scat:test:1'))
    expect(a).toEqual(b)
    expect(a.syllables).toHaveLength(11)
    for (let i = 1; i < a.syllables.length; i++) {
      expect(a.syllables[i]!.text).not.toBe(a.syllables[i - 1]!.text)
    }
    // note before rest (index 6) and final note (index 10) mark phraseEnd
    expect(a.syllables[6]!.phraseEnd).toBe(true)
    expect(a.syllables[10]!.phraseEnd).toBe(true)
    // peak note (midi 72 at index 3) is stressed
    expect(a.syllables[3]!.nucleus.stress).toBe(1)
  })

  it('every palette in bridge-scat/prompts.json parses cleanly and renders non-silent audio in Chimera WASM', async () => {
    const entries: string[] = JSON.parse(readFileSync(promptsPath, 'utf8'))
    expect(entries.length).toBeGreaterThanOrEqual(20)

    const { openThroat } = await import(`${page}throat.js`)
    const throat = await openThroat(
      readFileSync(`${page}throat/chimera.wasm`),
      gunzipSync(readFileSync(`${page}throat/cmudict.txt.gz`)).toString(),
    )

    const probeNotes: [number, number][] = [
      [60, 0.5], [64, 0.5], [67, 0.5], [69, 0.5], [67, 0.5], [64, 1], [0, 0.5],
    ]

    for (const entry of entries) {
      const sep = entry.indexOf(': ')
      expect(sep).toBeGreaterThan(0)
      const tokens = entry.slice(sep + 2).trim().split(/\s+/)
      expect(tokens.length).toBeGreaterThanOrEqual(6)
      expect(new Set(tokens).size).toBe(tokens.length)
      for (const tok of tokens) expect(isIpaScatToken(tok)).toBe(true)

      // Actually sing one probe phrase per palette in Chimera WASM!
      const scatted = composeScat(tokens, probeNotes, wrongness(`probe:${entry}`))
      const samples: Float32Array = throat.sing(
        { bpm: 96, lyrics: scatted.lyrics, syllables: scatted.syllables, notes: probeNotes, t0: 0.1, vibrato: 30 },
        'female',
      )
      expect(samples.length).toBeGreaterThan(48_000)
      let peak = 0
      for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]!))
      expect(peak).toBeGreaterThan(0.05)
    }
  }, 60_000)
})
