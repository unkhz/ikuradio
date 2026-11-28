import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { countSyllables, readSyllables, syllablesToStressed, throatScore } from './chimera.js'
import { speakInto } from './speak.js'

const home = new URL('../.chimera/', import.meta.url).pathname
const native = `${home}target/release/chimera`
const throatWasm = fileURLToPath(new URL('../../ui/public/throat/chimera.wasm', import.meta.url))
const cmudictGz = fileURLToPath(new URL('../../ui/public/throat/cmudict.txt.gz', import.meta.url))
const throatJs = fileURLToPath(new URL('../../ui/public/throat.js', import.meta.url))
const speechWasm = fileURLToPath(new URL('../../ui/public/throat/speech/chimera.wasm', import.meta.url))
const built = existsSync(native) && existsSync(throatWasm)

describe('Finnish via Chimera built-in front end', () => {
  it('groups Chimera syllable output into per-word stresses and commas', () => {
    const words = syllablesToStressed([
      { text: 'Tä', onset: [], nucleus: { ipa: 'æ̞', stress: 1 }, coda: [], wordEnd: false, phraseEnd: false },
      { text: 'mä', onset: [], nucleus: { ipa: 'æ̞', stress: 0 }, coda: [], wordEnd: true, phraseEnd: false },
      { text: 'lau', onset: [], nucleus: { ipa: 'ɑ̠u̝', stress: 1 }, coda: [], wordEnd: false, phraseEnd: false },
      { text: 'lu', onset: [], nucleus: { ipa: 'u̝', stress: 0 }, coda: [], wordEnd: true, phraseEnd: true },
    ])
    expect(words).toEqual([
      { stresses: [1, 0] },
      { stresses: [1, 0], comma: true },
    ])
  })

  it('keeps Finnish lyrics untouched in throatScore instead of running English readAloud', () => {
    const score = throatScore({
      bpm: 84,
      lang: 'fi',
      lyrics: '  Tämä on laulu, kierros 14,  ',
      notes: [[64, 1]],
    })
    expect(score.lyrics).toBe('Tämä on laulu, kierros 14,')
    expect(score.lang).toBe('fi')
  })

  it.skipIf(!built)('reads Finnish syllables, counts, and stresses directly from Chimera', async () => {
    const line = 'Tämä on laulu, kierros neljätoista,'
    const syls = await readSyllables(line, 'fi')
    expect(syls.map((s) => s.text)).toEqual([
      'Tä', 'mä', 'on', 'lau', 'lu', 'kier', 'ros', 'nel', 'jä', 'tois', 'ta',
    ])
    expect(await countSyllables(line, 'fi')).toBe(11)
    expect(syllablesToStressed(syls)).toEqual([
      { stresses: [1, 0] },
      { stresses: [1] },
      { stresses: [1, 0], comma: true },
      { stresses: [1, 0] },
      { stresses: [1, 0, 2, 0], comma: true },
    ])
  })

  it.skipIf(!built)('sings Finnish cleanly via Chimera WASM with lang: "fi" (no explicit syllables)', async () => {
    const { openThroat } = await import(throatJs)
    const throat = await openThroat(
      readFileSync(throatWasm),
      gunzipSync(readFileSync(cmudictGz)).toString(),
    )
    const lines = [
      'Lumous kietoo alla jään',
      'Sävel kantaa hiljaisuuteen',
      'Tuiki tuiki tähtönen, kukka, tuli, tulli, turma,',
      'Ha\'un vaa\'an tähtien',
    ]
    for (const line of lines) {
      const n = await countSyllables(line, 'fi')
      const notes = Array.from({ length: n }, (): [number, number] => [64, 0.5])
      notes.push([0, 1])
      const pcm: Float32Array = throat.sing(
        { bpm: 84, lang: 'fi', lyrics: line, notes, t0: 0.25, vibrato: 30 },
        'female',
      )
      expect(pcm.length).toBeGreaterThan(24000)
      let peak = 0
      for (let i = 0; i < pcm.length; i++) {
        const a = Math.abs(pcm[i]!)
        if (a > peak) peak = a
      }
      expect(peak).toBeGreaterThan(0.05)
      expect(Number.isFinite(peak)).toBe(true)
    }
  }, 60_000)

  it.skipIf(!existsSync(speechWasm))('speaks Finnish via Chimera speaking WASM with lang: "fi"', async () => {
    const out = await speakInto(
      { text: 'Hei, kuuletko minua? Vesihiisi sihisi hississä.', body: 'female', lang: 'fi' },
      '/tmp/ikuradio-finnish-speech-test.wav',
    )
    expect(out.seconds).toBeGreaterThan(1.5)
    expect(out.segments.length).toBeGreaterThan(15)
  }, 30_000)
})
