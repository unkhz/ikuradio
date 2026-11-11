import { describe, expect, it } from 'bun:test'
import { slowPhrase, slowSection } from './guide.js'
import { verseWalk } from './hooks.js'

describe('slowPhrase', () => {
  it('slows a phrase to the note on every second beat, held', () => {
    // a line of eighths: 0 0 1 2(long) 2 1 0 -1 0(long), then a breath
    const [line] = verseWalk
    const slow = slowPhrase(line, 8)
    expect(slow.reduce((sum, [, b]) => sum + b, 0)).toBe(8)
    expect(slow.length).toBeLessThanOrEqual(4)
    expect(line.notes.length).toBeGreaterThan(slow.length * 2)
  })

  it('holds the last note through the breath at the end of a line', () => {
    const slow = slowPhrase({ notes: [[3, 2], [5, 2]], rest: 4 }, 8)
    expect(slow).toEqual([
      [3, 2],
      [5, 6],
    ])
  })

  it('fits the line its own time, stretched or squeezed', () => {
    const slow = slowPhrase({ notes: [[0, 4], [2, 4]], rest: 0 }, 12)
    expect(slow).toEqual([
      [0, 6],
      [2, 6],
    ])
  })
})

describe('slowSection', () => {
  it('lays the lines end to end, and joins what meets on one note', () => {
    const notes = slowSection([
      { phrase: { notes: [[1, 4]], rest: 0 }, beats: 4 },
      { phrase: { notes: [[1, 2], [4, 2]], rest: 0 }, beats: 4 },
    ])
    expect(notes).toEqual([
      [1, 6],
      [4, 2],
    ])
  })
})

describe('setGuide', () => {
  it('hums a section with fewer notes, at the same tempo, in the singer key', async () => {
    const { setGuide, firstTune, firstCharacter } = await import('../index.js')
    const lines = firstTune.verse.map((phrase) => ({ phrase, beats: 8 }))
    const score = setGuide({ lines, lyrics: (n) => Array(n).fill('ooh').join(' '), singer: 'female' })
    const sung = firstTune.verse.reduce((sum, { notes }) => sum + notes.length, 0)
    expect(score.bpm).toBe(firstCharacter.tempo)
    expect(score.notes.length).toBeLessThan(sung / 2)
    expect(score.notes.reduce((sum, [, b]) => sum + b, 0)).toBe(32)
    expect(score.lyrics.split(' ')).toHaveLength(score.notes.length)
  })
})
