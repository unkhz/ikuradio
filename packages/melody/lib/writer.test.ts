import { describe, expect, it } from 'bun:test'
import { keyFor, type Singer } from '../index.js'
import { firstTune } from './variation.js'
import { vocalRange } from './reach.js'
import { degreeToMidi, modes, type ModeName } from './scale.js'
import { unfamiliarVerse } from './writer.js'
import { wrongness } from './wrongness.js'

const written = (song: string, singer: Singer = 'female', mode: ModeName = 'aeolian') => {
  const key = keyFor(singer, mode)
  return { key, verse: unfamiliarVerse(firstTune.verse, { key, range: vocalRange[singer], random: wrongness(`unfamiliar:${song}`) }) }
}
const songs = Array.from({ length: 24 }, (_, i) => `${i + 1}`)

describe('unfamiliarVerse', () => {
  it('keeps every line’s rhythm and rest, so the words fall as they always do', () => {
    for (const song of songs) {
      const { verse } = written(song)
      for (const [p, phrase] of verse.entries()) {
        expect(phrase.notes.map(([, beats]) => beats)).toEqual(firstTune.verse[p]!.notes.map(([, beats]) => beats))
        expect(phrase.rest).toBe(firstTune.verse[p]!.rest)
      }
    }
  })

  it('writes a melody the verse never had, and does not change the verse it was written from', () => {
    const before = JSON.stringify(firstTune.verse)
    for (const song of songs) {
      const { verse } = written(song)
      const same = verse.flatMap((phrase, p) => phrase.notes.filter(([d], i) => d === firstTune.verse[p]!.notes[i]![0]))
      expect(same.length / verse.flatMap((phrase) => phrase.notes).length).toBeLessThan(0.5)
    }
    expect(JSON.stringify(firstTune.verse)).toBe(before)
    expect(written('5').verse).not.toEqual(written('6').verse)
  })

  it('asks, answers, asks higher, and comes home to the tonic', () => {
    for (const song of songs) {
      const { verse } = written(song)
      const ends = verse.map((phrase) => phrase.notes.at(-1)![0])
      expect([4, 1]).toContain(ends[0]!)
      expect([0, 2]).toContain(ends[1]!)
      expect(ends[2]).toBe(4)
      expect(ends[3]).toBe(0)
      const highest = verse.map((phrase) => Math.max(...phrase.notes.map(([d]) => d)))
      for (const p of [0, 1, 3]) expect(highest[2]!).toBeGreaterThan(highest[p]!)
    }
  })

  it('reaches each cadence by step', () => {
    for (const song of songs) {
      for (const phrase of written(song).verse) {
        const [before, last] = phrase.notes.slice(-2).map(([d]) => d)
        expect(Math.abs(last! - before!)).toBeLessThanOrEqual(2)
      }
    }
  })

  it('moves mostly by step, and turns back after a leap', () => {
    let steps = 0
    let moves = 0
    let leaps = 0
    let turned = 0
    for (const song of songs) {
      for (const phrase of written(song).verse) {
        const d = phrase.notes.map(([degree]) => degree)
        for (let i = 1; i < d.length; i++) {
          moves++
          if (Math.abs(d[i]! - d[i - 1]!) <= 2) steps++
          if (i >= 2 && Math.abs(d[i - 1]! - d[i - 2]!) >= 3) {
            leaps++
            if (Math.sign(d[i]! - d[i - 1]!) !== Math.sign(d[i - 1]! - d[i - 2]!)) turned++
          }
        }
      }
    }
    expect(steps / moves).toBeGreaterThan(0.7)
    if (leaps) expect(turned / leaps).toBeGreaterThan(0.8)
  })

  it('stays within what the lead can sing, whoever leads, in every mode', () => {
    for (const mode of Object.keys(modes) as ModeName[]) {
      for (const singer of ['female', 'male', 'child'] as Singer[]) {
        const { key, verse } = written(`range:${mode}`, singer, mode)
        const [low, high] = vocalRange[singer]
        for (const [d] of verse.flatMap((phrase) => phrase.notes)) {
          expect(degreeToMidi(d, key)).toBeGreaterThanOrEqual(low)
          expect(degreeToMidi(d, key)).toBeLessThanOrEqual(high)
        }
      }
    }
  })

  it('writes the same verse for the same Song', () => {
    expect(written('42').verse).toEqual(written('42').verse)
  })
})
