import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import type { Score } from 'melody'
import {
  countFinnishSyllables,
  expandFinnishTake,
  finnishStressedLine,
  syllabifyFinnishWord,
} from './finnish.js'

const throatWasm = fileURLToPath(new URL('../../ui/public/throat/chimera.wasm', import.meta.url))
const cmudictGz = fileURLToPath(new URL('../../ui/public/throat/cmudict.txt.gz', import.meta.url))
const throatJs = fileURLToPath(new URL('../../ui/public/throat.js', import.meta.url))

describe('Finnish syllabification and stress', () => {
  it('syllabifies Finnish words with diphthongs, long vowels, and consonant clusters', () => {
    expect(syllabifyFinnishWord('Revontulet')).toEqual(['re', 'von', 'tu', 'let'])
    expect(syllabifyFinnishWord('kierros')).toEqual(['kier', 'ros'])
    expect(syllabifyFinnishWord('neljätoista')).toEqual(['nel', 'jä', 'tois', 'ta'])
    expect(syllabifyFinnishWord('ikuinen')).toEqual(['i', 'kui', 'nen'])
    expect(syllabifyFinnishWord('ystäväiseni')).toEqual(['ys', 'tä', 'väi', 'se', 'ni'])
    expect(syllabifyFinnishWord('Suomi')).toEqual(['suo', 'mi'])
    expect(syllabifyFinnishWord('yöllä')).toEqual(['yöl', 'lä'])
  })

  it('counts syllables and places primary stress on every word initial syllable', () => {
    const line = 'Tämä on laulu, kierros neljätoista,'
    expect(countFinnishSyllables(line)).toBe(11)
    const stressed = finnishStressedLine(line)
    expect(stressed).toEqual([
      { stresses: [1, 0] },
      { stresses: [1] },
      { stresses: [1, 0], comma: true },
      { stresses: [1, 0] },
      { stresses: [1, 0, 2, 0], comma: true },
    ])
  })
})

describe('expandFinnishTake', () => {
  it('maps Finnish vowels, dental t̪/l̪, tight-VOT stops, geminates, and native diphthongs with offglideShare', () => {
    const line = 'kierros Suomi yöllä tähtönen turma'
    const base: Score = {
      bpm: 80,
      lyrics: line,
      notes: [
        [69, 0.5], [69, 1.0],
        [0, 0.25],
        [67, 0.5], [67, 1.0],
        [0, 0.25],
        [65, 0.5], [65, 1.0],
        [0, 0.25],
        [64, 0.5], [64, 0.5], [64, 1.0],
        [0, 0.25],
        [62, 0.5], [62, 1.0],
      ],
    }
    const expanded = expandFinnishTake(base, line)
    expect(expanded.syllables).toBeDefined()
    const sounding = expanded.notes.filter(([m]) => m > 0)
    expect(expanded.syllables!.length).toBe(sounding.length)

    // kierros -> kier (k tight-VOT + ie offglide 0.60) + ros (single geminate r dur=0.165)
    expect(expanded.syllables![0]!.onset).toEqual([{ ipa: 'k', aspirated: true, vot: 0.012 }])
    expect(expanded.syllables![0]!.nucleus.ipa).toBe('ie')
    expect(expanded.syllables![0]!.offglideShare).toBe(0.60)
    expect(expanded.syllables![0]!.coda).toEqual([])
    expect(expanded.syllables![1]!.onset).toEqual([{ ipa: 'r', dur: 0.165 }])

    // Suomi -> ʊɔ (u̠+ɔ) with offglide 0.60
    expect(expanded.syllables![2]!.nucleus.ipa).toBe('ʊɔ')
    expect(expanded.syllables![2]!.offglideShare).toBe(0.60)

    // yöllä -> yœ + geminate l̪ (dur=0.175) + open front æ̞
    expect(expanded.syllables![4]!.nucleus.ipa).toBe('yœ')
    expect(expanded.syllables![4]!.offglideShare).toBe(0.60)
    expect(expanded.syllables![5]!.onset).toEqual([{ ipa: 'l̪', dur: 0.175 }])
    expect(expanded.syllables![5]!.nucleus.ipa).toBe('æ̞')

    // tähtönen -> dental t̪ + æ̞ + h, t̪ + œ, nen
    expect(expanded.syllables![6]!.onset).toEqual([{ ipa: 't̪', aspirated: true, vot: 0.012 }])
    expect(expanded.syllables![6]!.nucleus.ipa).toBe('æ̞')
    expect(expanded.syllables![7]!.onset).toEqual([{ ipa: 't̪', aspirated: true, vot: 0.012 }])
    expect(expanded.syllables![7]!.nucleus.ipa).toBe('œ')

    // turma -> t̪ + back u̠ + boosted coda r (0.135)
    expect(expanded.syllables![9]!.nucleus.ipa).toBe('u̠')
    expect(expanded.syllables![9]!.coda).toEqual([{ ipa: 'r', dur: 0.135 }])
  })

  it('boosts l̪ onset duration after voiceless stop codas (Revontulet leiskuvat)', () => {
    const line = 'Revontulet leiskuvat'
    const base: Score = {
      bpm: 76,
      lyrics: line,
      notes: Array.from({ length: countFinnishSyllables(line) }, () => [64, 0.5] as [number, number]),
    }
    const expanded = expandFinnishTake(base, line)
    // syllable 3 is `let` (coda t̪), syllable 4 is `leis` (onset l̪ boosted to 0.088)
    expect(expanded.syllables![3]!.coda).toEqual([{ ipa: 't̪', aspirated: true, vot: 0.012 }])
    expect(expanded.syllables![4]!.onset).toEqual([{ ipa: 'l̪', dur: 0.088 }])
  })

  it('renders cleanly through Chimera WASM without error', async () => {
    const { openThroat } = await import(throatJs)
    const throat = await openThroat(
      readFileSync(throatWasm),
      gunzipSync(readFileSync(cmudictGz)).toString(),
    )
    const lines = [
      'Tämä on laulu, kierros neljätoista,',
      'Revontulet leiskuvat yöllä,',
      'Tuiki tuiki tähtönen, kukka, tuli, tulli, turma,',
      'Kuule laulu ikuinen',
    ]
    for (const line of lines) {
      const n = countFinnishSyllables(line)
      const score = expandFinnishTake(
        {
          bpm: 80,
          lyrics: line,
          notes: Array.from({ length: n }, () => [64, 0.5] as [number, number]),
        },
        line,
      )
      const pcm: Float32Array = throat.sing({ ...score, t0: 0.25, vibrato: 30 }, 'female')
      expect(pcm.length).toBeGreaterThan(4800)
    }
  })
})
