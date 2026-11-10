import { describe, expect, it } from 'bun:test'
import { firstMood } from 'mood'
import { firstLyrics } from 'song'
import { lastsFor, placeOf } from './compose.js'
import type { Page, SongPlace } from './diary.js'

const page = (iteration: number, song?: SongPlace): Page => ({
  iteration: `${iteration}`,
  mood: firstMood,
  lyrics: firstLyrics,
  written: '2026-11-11T00:00:00.000Z',
  ...(song ? { song } : {}),
})

describe('placeOf', () => {
  it('begins the very first Song at the very first iteration', () => {
    expect(placeOf(0n, undefined, 4)).toEqual({
      beginsSong: true,
      number: 0n,
      began: 0n,
    })
  })

  it('reads old pages as Songs of the same length, counted from the start', () => {
    // the scientist's diary: iterations 0 to 7, written when every Song lasted four
    expect(placeOf(6n, page(5), 4)).toMatchObject({
      beginsSong: false,
      number: 1n,
      began: 4n,
      lasts: 4,
    })
    expect(placeOf(8n, page(7), 4)).toMatchObject({
      beginsSong: true,
      number: 2n,
      began: 8n,
    })
  })

  it('holds a Song for as long as it was given', () => {
    const song = { number: '2', began: '8', lasts: 5 }
    expect(placeOf(12n, page(11, song), 4)).toMatchObject({
      beginsSong: false,
      number: 2n,
    })
    expect(placeOf(13n, page(12, song), 4)).toMatchObject({
      beginsSong: true,
      number: 3n,
      began: 13n,
    })
  })
})

describe('lastsFor', () => {
  it('lasts about as long as asked, and the same weather always as long', () => {
    const moods = [
      ['eternity', 'romantic chamber music with violin and cello'],
      ['the moon begins to wane', 'a lighthouse'],
      ['70s psychedelic funk', 'piano ballad'],
      ['rust', 'dub'],
      ['snow on a radio', 'an empty harbour'],
      ['glass', 'tide'],
    ].map((descriptions) => ({
      descriptions,
      character: { mode: 'aeolian' as const, tempo: 76 },
    }))
    const lengths = moods.map((mood) => lastsFor(mood, 4))
    for (const length of lengths) {
      expect(length).toBeGreaterThanOrEqual(3)
      expect(length).toBeLessThanOrEqual(6)
    }
    // not every Song is the same length
    expect(new Set(lengths).size).toBeGreaterThan(1)
    expect(moods.map((mood) => lastsFor(mood, 4))).toEqual(lengths)
    expect(lastsFor(moods[0], 1)).toBeGreaterThanOrEqual(2)
  })
})
