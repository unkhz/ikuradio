import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { ofItsAge, specialByWord, specialWords, stressedWords, stressOf } from 'song'
import { Rhymes, lastWord, parseDictionary } from '../../song/lib/rhyme.js'
import { isIpaScatToken } from './scat.js'
import { hasSpecialWord, resolveLineSyllables, specialWordSyllables } from './special.js'

const page = new URL('../../ui/public/', import.meta.url).pathname

describe('special words lexicon & hybrid IPA syllable override', () => {
  it('every special word is unique, timeless, has aligned IPA/stress/ARPA counts, and valid Chimera IPA', () => {
    expect(specialWords.length).toBeGreaterThanOrEqual(70)
    const seen = new Set<string>()
    for (const entry of specialWords) {
      const lower = entry.word.toLowerCase()
      expect(seen.has(lower)).toBe(false)
      seen.add(lower)
      expect(entry.gloss.trim().length).toBeGreaterThan(5)
      expect(ofItsAge(entry.word)).toBe(false)
      expect(entry.ipa.length).toBeGreaterThanOrEqual(1)
      expect(entry.stresses).toHaveLength(entry.ipa.length)
      expect(stressOf(entry.arpa)).toHaveLength(entry.ipa.length)
      for (const syl of entry.ipa) expect(isIpaScatToken(syl)).toBe(true)
    }
  })

  it('registers special words into Rhymes and matches English chorus numbers', () => {
    const base = parseDictionary([
      'one\tW AH1 N',
      'two\tT UW1',
      'three\tTH R IY1',
      'four\tF AO1 R',
      'five\tF AY1 V',
      'six\tS IH1 K S',
      'seven\tS EH1 V AH0 N',
      'eight\tEY1 T',
      'nine\tN AY1 N',
      'ten\tT EH1 N',
      'fourteen\tF AO0 R T IY1 N',
      'hundred\tHH AH1 N D R AH0 D',
      'thousand\tTH AW1 Z AH0 N D',
      'million\tM IH1 L Y AH0 N',
    ].join('\n'))
    const dict = new Rhymes(base, specialWords)

    // Strict rhymes exist for all the common number endings
    for (const num of ['one', 'two', 'three', 'four', 'five', 'six', 'eight', 'nine', 'ten', 'fourteen']) {
      const offered = dict.specialOffer(num, 5)
      expect(offered.length).toBeGreaterThanOrEqual(2)
      for (const s of offered) expect(dict.rhymes(s.word, num, false)).toBe(true)
    }
    // Loose vowel rhymes exist for tough numbers like seven, hundred, thousand, million
    for (const num of ['seven', 'hundred', 'thousand', 'million']) {
      const offered = dict.specialOffer(num, 5, { loosely: true })
      expect(offered.length).toBeGreaterThanOrEqual(1)
      for (const s of offered) expect(dict.rhymes(s.word, num, true)).toBe(true)
    }

    // Unicode diacritic words survive lastWord and stressedWords
    expect(lastWord('Steam rises like löyly,')).toBe('löyly')
    expect(lastWord('Awake, frost jötunn!')).toBe('jötunn')
    const sw = stressedWords('Steam rises like löyly and jötunn,', dict.words)
    expect(sw.find((w) => w.text === 'löyly')?.stresses).toEqual([1, 0])
    expect(sw.find((w) => w.text === 'jötunn')?.stresses).toEqual([1, 2])
  })

  it('returns undefined for ordinary English lines and splices hybrid IPA for lines with special words', async () => {
    expect(hasSpecialWord('This is the song that never ends.')).toBe(false)
    expect(await resolveLineSyllables('This is the song that never ends.')).toBeUndefined()

    const line = 'Under the revontuli, a kantele wakes the petrichor.'
    expect(hasSpecialWord(line)).toBe(true)
    const resolved = await resolveLineSyllables(line)
    expect(resolved).toBeDefined()
    // Under(2) + the(1) + revontuli(4) + a(1) + kantele(3) + wakes(1) + the(1) + petrichor(3) = 16
    expect(resolved).toHaveLength(16)
    // Special words carry their exact IPA & phraseEnd punctuation
    expect(resolved![3]!.text).toBe('re')
    expect(resolved![6]!.text).toBe('liː')
    expect(resolved![6]!.phraseEnd).toBe(true)
    expect(resolved![15]!.text).toBe('kɔr')
    expect(resolved![15]!.phraseEnd).toBe(true)
  })

  it('every special word renders clean non-silent audio in Chimera WASM', async () => {
    const { openThroat } = await import(`${page}throat.js`)
    const throat = await openThroat(
      readFileSync(`${page}throat/chimera.wasm`),
      gunzipSync(readFileSync(`${page}throat/cmudict.txt.gz`)).toString(),
    )

    // Render in batches of 8 words per call to keep test fast while covering all 74 words!
    for (let i = 0; i < specialWords.length; i += 8) {
      const batch = specialWords.slice(i, i + 8)
      const syllables = batch.flatMap((entry) => specialWordSyllables(entry, { phraseEnd: true }))
      const notes: [number, number][] = syllables.map((_, k) => [62 + (k % 5), 0.5])
      notes.push([0, 0.5])
      const samples: Float32Array = throat.sing(
        { bpm: 100, lyrics: batch.map((e) => e.word).join(' '), syllables, notes, t0: 0.1, vibrato: 25 },
        'female',
      )
      expect(samples.length).toBeGreaterThan(48_000)
      let peak = 0
      for (let s = 0; s < samples.length; s++) peak = Math.max(peak, Math.abs(samples[s]!))
      expect(peak).toBeGreaterThan(0.05)
    }

    // Also render one full hybrid English + special-word line end-to-end
    const hybrid = 'Beneath the revontuli, our kantele sings petrichor.'
    const syls = (await resolveLineSyllables(hybrid))!
    const notes: [number, number][] = syls.map((_, k) => [62 + (k % 6), 0.5])
    notes.push([0, 0.5])
    const pcm: Float32Array = throat.sing(
      { bpm: 92, lyrics: hybrid, syllables: syls, notes, t0: 0.15, vibrato: 30 },
      'female',
    )
    expect(pcm.length).toBeGreaterThan(96_000)
    expect(specialByWord.get('ikuradio')?.ipa).toHaveLength(5)
  }, 60_000)
})
