import { describe, expect, it } from 'bun:test'
import { firstMood } from 'mood'
import { firstLyrics } from 'song'
import { firstChoir } from 'vocals'
import { firstTune, vocalRange } from 'melody'
import { defaults } from 'perspectives'
import { rezzy } from 'dj'
import type { Iteration } from './compose.js'
import { declare, introBeats, introScore, introSeconds, leadIn, leadOut } from './intro.js'

const first: Iteration = {
  iteration: 0n,
  mood: firstMood,
  choir: firstChoir,
  tune: firstTune,
  variation: 0,
  sung: firstTune,
  beginsSong: true,
  song: { number: '7', began: '0', lasts: 4 },
  lyrics: firstLyrics,
  perspectives: [],
  settings: defaults(3),
  rate: 6,
}

describe('introScore', () => {
  const score = introScore(first)

  it('is four bars at the Song\'s tempo, hummed, in the reach of the lead', () => {
    expect(score.bpm).toBe(firstMood.character.tempo)
    expect(score.notes.reduce((sum, [, beats]) => sum + beats, 0)).toBe(introBeats)
    expect(score.lyrics.split(' ').length).toBe(score.notes.length)
    const [low, high] = vocalRange[firstChoir[0]!.body]
    for (const [midi] of score.notes) {
      expect(midi).toBeGreaterThanOrEqual(low)
      expect(midi).toBeLessThanOrEqual(high)
    }
  })

  it('lasts as long as introSeconds says', () => {
    expect(introSeconds(80)).toBe(12)
    expect(introSeconds(76)).toBeCloseTo(12.632, 3)
  })
})

describe('declare', () => {
  /** A speaking throat that takes 0.3 seconds a word, and a tenth less for each tenth of rate more. */
  const said = (request: { text: string; rate: number }) => ({ end: (request.text.split(/\s+/).length * 0.3) / request.rate })

  it('puts what the DJ says in the room the music leaves, after the held tone', async () => {
    const declaration = (await declare(rezzy, '7', 80, 'Hello, friend. Here is a slow song about rain.', said))!
    expect(declaration).toMatchObject({ dj: 'rezzy', song: '7' })
    const { intro } = declaration.parts
    expect(intro!.at).toBe(leadIn)
    expect(intro!.at + intro!.seconds).toBeLessThanOrEqual(introSeconds(80) - leadOut + 1e-9)
    expect(intro!.speech.text).toBe('Hello, friend. Here is a slow song about rain.')
    expect(intro!.speech.squeeze).toBeUndefined()
  })

  it('keeps how much the speech was hurried, and cuts a speech that is too long even so', async () => {
    const long = Array.from({ length: 70 }, (_, i) => `word${i}`).join(' ') + '.'
    const declaration = (await declare(rezzy, '7', 80, long, said))!
    expect(declaration.parts.intro!.speech.text.split(' ').length).toBeLessThan(70)
    expect(declaration.parts.intro!.at + declaration.parts.intro!.seconds).toBeLessThanOrEqual(introSeconds(80) - leadOut)
  })

  it('says nothing for a speech with no words, and the Song has its intro still', async () => {
    expect(await declare(rezzy, '7', 80, '', said)).toBeUndefined()
  })
})
