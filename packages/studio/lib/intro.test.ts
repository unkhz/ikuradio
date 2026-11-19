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
  const stresses = new Map<string, number[]>([['hello', [0, 1]], ['friend', [1]]])

  it('puts what the DJ says in the room the music leaves, after the held tone', () => {
    const declaration = declare(rezzy, '7', 80, 'Hello, friend. Here is a slow song about rain.', stresses)!
    expect(declaration).toMatchObject({ dj: 'rezzy', song: '7' })
    const { intro } = declaration.parts
    expect(intro!.at).toBe(leadIn)
    expect(intro!.at + intro!.seconds).toBeLessThanOrEqual(introSeconds(80) - leadOut + 1e-9)
    expect(Object.keys(intro!.speech).sort()).toEqual(['bpm', 'lyrics', 'notes'])
  })

  it('says nothing for a speech that does not fit, and the Song has its intro still', () => {
    expect(declare(rezzy, '7', 80, '', stresses)).toBeUndefined()
  })
})
