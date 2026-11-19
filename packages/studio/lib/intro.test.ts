import { describe, expect, it } from 'bun:test'
import type { Mood } from 'mood'
import type { Session } from 'archive'
import { vocalRange } from 'melody'
import { rezzy } from 'dj'
import { declare, introBeats, introRecord, introScore, introSeconds, leadIn, openingOf, syllablesASecond, unrhythmic } from './intro.js'

const session = (tempo: number, body: 'male' | 'female' | 'child' = 'female') =>
  ({
    song: '7',
    mood: ['rain', 'gears'],
    mode: 'dorian',
    tempo,
    singers: [{ body, harmony: 0 }],
    iterations: [{ parts: [{ type: 'verse', at: 0, lines: [{ at: 1, text: 'x' }] }] }],
    recordings: [{ id: 'v', kind: 'voice', voice: 0, at: 1, take: { bpm: tempo, lyrics: 'a line of words here', notes: [[64, 1], [66, 1], [69, 2], [67, 2]] } }],
  }) as unknown as Session

describe('introScore', () => {
  it('lasts fifteen seconds at the Song\'s tempo, hummed, in the reach of the lead', () => {
    const score = introScore(openingOf(session(80))!)
    const beats = score.notes.reduce((sum, [, b]) => sum + b, 0)
    expect(beats).toBeCloseTo(introBeats(80), 6)
    expect((beats * 60) / score.bpm).toBeCloseTo(introSeconds, 6)
    expect(score.lyrics.split(' ')).toHaveLength(score.notes.length)
    const [low, high] = vocalRange.female
    for (const [midi] of score.notes) {
      expect(midi).toBeGreaterThanOrEqual(low)
      expect(midi).toBeLessThanOrEqual(high)
    }
  })

  it('is as long for a slow Song as for a quick one', () => {
    for (const tempo of [50, 76, 140]) {
      const notes = introScore(openingOf(session(tempo))!).notes
      expect((notes.reduce((sum, [, b]) => sum + b, 0) * 60) / tempo).toBeCloseTo(introSeconds, 6)
    }
  })

  it('leans on a step beside the first note the verse sings, which the verse then resolves', () => {
    const opened = openingOf(session(80, 'male'))!
    const notes = introScore(opened).notes
    const first = opened.phrase.notes[0]![0]
    expect(typeof first).toBe('number')
    expect(notes.length).toBeGreaterThan(6)
  })
})

describe('unrhythmic', () => {
  const mood = (sound: string | undefined, descriptions: string[]) => ({ descriptions, character: { mode: 'dorian', tempo: 80, sound } }) as unknown as Mood

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

describe('what is kept', () => {
  it('keeps a DJ\'s words with an estimate of how long they take, after the held tone', () => {
    const declaration = declare(rezzy, '7', 'Hello there, friend.', 39)
    expect(declaration).toEqual({ dj: 'rezzy', song: '7', parts: { intro: { at: leadIn, seconds: 10, speech: { text: 'Hello there, friend.' } } } })
    expect(syllablesASecond * 10).toBeCloseTo(39, 0)
  })

  it('keeps the intro as its Session would, before the Song\'s moment 0, with how loud it sounds', () => {
    expect(introRecord('7', 'abc.m4a', { file: 'f', at: -15, gain: 0.45, seconds: 15, fade: 3 }, { lufs: -20, peak: -3 })).toEqual({
      song: '7',
      seconds: 15,
      recording: { id: 'abc.m4a', at: -15, gain: 0.45, kind: 'bed', seconds: 15, fade: 3, loudness: { lufs: -20, peak: -3 } },
    })
  })
})
