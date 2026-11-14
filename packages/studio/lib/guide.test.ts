import { describe, expect, it } from 'bun:test'
import type { Section } from 'music'
import type { Guide } from './guide.js'
import { guidesFor, inversion, lowerVoice, syllablesOf } from './guide.js'
import type { SungLine } from './perform.js'

const sungLine = (index: number, at: number, notes: [number, number][], lyrics: string): SungLine => ({
  part: 'verse',
  index,
  lyrics,
  file: 'x.m4a',
  voices: [{ file: 'x.m4a', voice: 0, gain: 1, take: { bpm: 60, lyrics, notes, t0: 0.5, vibrato: 0 } }],
  recordings: [],
  seconds: 4,
  enters: 0.5,
  voiced: 3,
  at,
})

describe('the two-voice guide in the Studio', () => {
  it('times the syllables as the lead sang them, in the Song’s beats, with the words’ stress', async () => {
    const lines = [
      sungLine(0, 10, [[57, 1], [0, 0.5], [59, 1], [60, 1]], 'over there'),
      sungLine(1, 14, [[57, 2], [59, 1]], 'come home'),
    ]
    const section: Section<SungLine> = { part: 'verse', kind: 'verse', at: 10, seconds: 8, lines }
    const stressed = async (line: string) =>
      line === 'over there' ? [{ stresses: [1, 0] }, { stresses: [1], comma: true }] : [{ stresses: [1] }, { stresses: [1] }]
    // at 120 bpm the takes' 60-bpm beats count double, from the breath on
    const syllables = await syllablesOf(section, 120, stressed)
    expect(syllables.map(({ at, beats, stress, begins, comma, lineEnd }) => [at, beats, stress, begins, comma, lineEnd])).toEqual([
      [1, 2, 1, true, false, false],
      [4, 2, 0, false, false, false],
      [6, 2, 1, true, true, true],
      [9, 4, 1, true, false, false],
      [13, 2, 1, true, false, true],
    ])
  })

  it('lends no syllables from a line whose words cannot be told apart', async () => {
    const section: Section<SungLine> = { part: 'verse', kind: 'verse', at: 0, seconds: 4, lines: [sungLine(0, 0, [[57, 1]], 'hm')] }
    expect(await syllablesOf(section, 60, async () => undefined)).toEqual([])
  })

  it('gives the lower voice to the lowest body in the choir that reaches it with room below, else the man', () => {
    const choir = [
      { body: 'child' as const, harmony: 0, gain: 1 },
      { body: 'female' as const, harmony: -2, gain: 0.5, throat: { pressure: 8, tension: 0.5, breathiness: 0.2 } },
    ]
    expect(lowerVoice(choir, 52)).toEqual({ body: 'female', throat: { pressure: 8, tension: 0.5, breathiness: 0.2 } })
    // near the bottom of her reach a woman is mostly overtones: the man hums it
    expect(lowerVoice(choir, 45)).toEqual({ body: 'male' })
    expect(lowerVoice([{ body: 'child', harmony: 0, gain: 1 }], 45)).toEqual({ body: 'male' })
  })

  it('turns a row upside down about its first pitch, still all twelve', () => {
    const row = [3, 7, 0, 11, 1, 9, 4, 6, 10, 2, 5, 8]
    const turned = inversion(row)
    expect(turned[0]).toBe(3)
    expect(turned[1]).toBe(11)
    expect([...turned].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('hands the Music a two-voice guide by its section, an old one by its kind', () => {
    const guide = (kind: Guide['kind'], file: string, section?: number) => ({ kind, file, section }) as Guide
    expect([...guidesFor([guide('verse', 'a', 0), guide('verse', 'b', 2)])]).toEqual([[0, 'a'], [2, 'b']])
    expect([...guidesFor([guide('chorus', 'c')])]).toEqual([['chorus', 'c']])
  })
})
