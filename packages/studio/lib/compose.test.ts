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
    expect(placeOf(1n, undefined, 4)).toEqual({
      beginsSong: true,
      number: 1n,
      began: 1n,
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
  it('lasts as long as asked, whatever the weather', () => {
    const moods = [
      ['eternity', 'romantic chamber music with violin and cello'],
      ['70s psychedelic funk', 'piano ballad'],
      ['glass', 'tide'],
    ].map((descriptions) => ({
      descriptions,
      character: { mode: 'aeolian' as const, tempo: 76 },
    }))
    expect(moods.map((mood) => lastsFor(mood, 2))).toEqual([2, 2, 2])
    expect(lastsFor(moods[0], 0)).toBe(1)
  })
})
