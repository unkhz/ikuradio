import { describe, expect, it } from 'bun:test'
import { wrongness } from './wrongness.js'
import { atonal, rowName, toneRow } from './atonal.js'

describe('toneRow', () => {
  it('draws all twelve pitches, each once, the same for the same wrongness', () => {
    const row = toneRow(wrongness('row:7'))
    expect([...row].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(toneRow(wrongness('row:7'))).toEqual(row)
    expect(toneRow(wrongness('row:8'))).not.toEqual(row)
  })

  it('is read by the names of its pitches', () => {
    expect(rowName([0, 6, 9, 1, 2, 3, 4, 5, 7, 8, 10, 11])).toBe('C F# A C# D D# E F G G# A# B')
  })
})

describe('atonal', () => {
  const row = [0, 6, 9, 1, 11, 4, 2, 8, 3, 10, 5, 7]
  // a bridge that stood on one note, and one that walked up its key
  const score = { bpm: 72, lyrics: 'mm', notes: [[60, 2], [0, 1], [60, 1], [62, 1], [64, 1], [65, 2], [67, 4]] as [number, number][] }

  it('keeps the rhythm and the rests, to the beat', () => {
    const lost = atonal(score, row)
    expect(lost.notes.map(([, beats]) => beats)).toEqual(score.notes.map(([, beats]) => beats))
    expect(lost.notes[1]).toEqual([0, 1])
    expect(lost.bpm).toBe(72)
  })

  it('gives every sounding note the next pitch of the row, in the nearest octave', () => {
    const pitches = atonal(score, row).notes.filter(([midi]) => midi).map(([midi]) => midi)
    expect(pitches.map((midi) => midi % 12)).toEqual(row.slice(0, 6))
    for (const [i, midi] of pitches.entries()) {
      const was = score.notes.filter(([m]) => m)[i]![0]
      expect(Math.abs(midi - was)).toBeLessThanOrEqual(6)
    }
  })

  it('never says the same pitch twice in a row, where the bridge stood still', () => {
    const [first, , second] = atonal(score, row).notes
    expect(first![0]).not.toBe(second![0])
  })

  it('refuses anything that is not a row of all twelve', () => {
    expect(() => atonal(score, [0, 1, 2])).toThrow()
    expect(() => atonal(score, [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toThrow()
  })
})
