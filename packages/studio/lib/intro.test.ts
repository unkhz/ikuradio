import { describe, expect, it } from 'bun:test'
import { firstMood } from 'mood'
import { firstLyrics } from 'song'
import { firstChoir } from 'vocals'
import { firstTune, vocalRange } from 'melody'
import { defaults } from 'perspectives'
import { rezzy } from 'dj'
import type { Iteration } from './compose.js'
import { declare, introBeats, introScore, introSeconds, leadIn, leadOut, unrhythmic } from './intro.js'

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

  it('lasts fifteen seconds at the Song\'s tempo, hummed, in the reach of the lead', () => {
    expect(score.bpm).toBe(firstMood.character.tempo)
    expect(score.notes.reduce((sum, [, beats]) => sum + beats, 0)).toBeCloseTo(introBeats(score.bpm), 6)
    expect((score.notes.reduce((sum, [, beats]) => sum + beats, 0) * 60) / score.bpm).toBeCloseTo(introSeconds, 6)
    expect(score.lyrics.split(' ').length).toBe(score.notes.length)
    const [low, high] = vocalRange[firstChoir[0]!.body]
    for (const [midi] of score.notes) {
      expect(midi).toBeGreaterThanOrEqual(low)
      expect(midi).toBeLessThanOrEqual(high)
    }
  })

  it('is as long for a slow Song as for a quick one', () => {
    for (const tempo of [50, 76, 140]) {
      const notes = introScore({ ...first, mood: { ...firstMood, character: { ...firstMood.character, tempo } } }).notes
      expect((notes.reduce((sum, [, beats]) => sum + beats, 0) * 60) / tempo).toBeCloseTo(introSeconds, 6)
    }
  })
})

describe('declare', () => {
  /** A speaking throat that takes 0.3 seconds a word, and a tenth less for each tenth of rate more. */
  const said = (request: { text: string; rate: number }) => ({ end: (request.text.split(/\s+/).length * 0.3) / request.rate })

  it('puts what the DJ says in the room the music leaves, after the held tone', async () => {
    const declaration = (await declare(rezzy, '7', 'Hello, friend. Here is a slow song about rain.', said))!
    expect(declaration).toMatchObject({ dj: 'rezzy', song: '7' })
    const { intro } = declaration.parts
    expect(intro!.at).toBe(leadIn)
    expect(intro!.at + intro!.seconds).toBeLessThanOrEqual(introSeconds - leadOut + 1e-9)
    expect(intro!.speech.text).toBe('Hello, friend. Here is a slow song about rain.')
    expect(intro!.speech.squeeze).toBeUndefined()
  })

  it('keeps how much the speech was hurried, and cuts a speech that is too long even so', async () => {
    const long = Array.from({ length: 70 }, (_, i) => `word${i}`).join(' ') + '.'
    const declaration = (await declare(rezzy, '7', long, said))!
    expect(declaration.parts.intro!.speech.text.split(' ').length).toBeLessThan(70)
    expect(declaration.parts.intro!.at + declaration.parts.intro!.seconds).toBeLessThanOrEqual(introSeconds - leadOut)
  })

  it('says nothing for a speech with no words, and the Song has its intro still', async () => {
    expect(await declare(rezzy, '7', '', said)).toBeUndefined()
  })
})

describe('unrhythmic', () => {
  const mood = (sound: string | undefined, descriptions: string[]) => ({ ...firstMood, descriptions, character: { ...firstMood.character, sound } })

  it('asks for the Song\'s own sound, without its tempo, and for nothing rhythmic', () => {
    const asked = unrhythmic(mood('reverberant organ chords', ['sunset']))
    expect(asked).toContain('reverberant organ chords')
    expect(asked).not.toMatch(/bpm/)
    expect(asked).toContain('no drums')
  })

  it('does not ask for a band that is heard as drums, but for the weather, or for pads', () => {
    expect(unrhythmic(mood('driving drum kit and bass', ['rain', 'gears']))).toContain('rain, gears')
    expect(unrhythmic(mood('driving drum kit and bass', ['a heavy beat']))).toContain('warm sustained pads')
  })
})
