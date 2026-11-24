import { describe, expect, it } from 'bun:test'
import { firstMood } from 'mood'
import { firstLyrics } from 'song'
import { firstTune } from 'melody'
import { defaults } from 'perspectives'
import { fittingFor, placeOf } from './compose.js'
import type { Page, SongPlace } from './diary.js'

const page = (iteration: number, song?: SongPlace): Page => ({
  iteration: `${iteration}`,
  mood: firstMood,
  lyrics: firstLyrics,
  written: '2026-11-11T00:00:00.000Z',
  ...(song ? { song } : {}),
})

const four = { id: 'the-song', iterations: 4 }
const two = { id: 'the-song', iterations: 2 }

describe('placeOf', () => {
  it('begins the very first Song at the very first iteration, as the Arrangement taken, as long as it is', () => {
    expect(placeOf(1n, undefined, four)).toEqual({ beginsSong: true, number: 1n, began: 1n, lasts: 4, arrangement: 'the-song' })
    expect(placeOf(1n, undefined, { id: 'other', iterations: 3 })).toMatchObject({ lasts: 3, arrangement: 'other' })
  })

  it('reads old pages as Songs of the same length, counted from the start, made as the Song as it always was', () => {
    // the scientist's diary: iterations 0 to 7, written when every Song lasted four
    expect(placeOf(6n, page(5), four)).toMatchObject({ beginsSong: false, number: 1n, began: 4n, lasts: 4, arrangement: 'the-song' })
    expect(placeOf(8n, page(7), four)).toMatchObject({ beginsSong: true, number: 2n, began: 8n })
  })

  it('holds a Song for as long as it was given', () => {
    const song = { number: '2', began: '8', lasts: 5 }
    expect(placeOf(12n, page(11, song), four)).toMatchObject({ beginsSong: false, number: 2n })
    expect(placeOf(13n, page(12, song), four)).toMatchObject({ beginsSong: true, number: 3n, began: 13n })
  })

  it('is, for the Song as it always was, what two iterations to a Song gave: across the boundary of a Song and into the next', () => {
    // the Songs the Studio has made: iteration 1 begins Song 1, iteration 2 ends it, iteration 3 begins Song 2
    const places = []
    let last: Page | undefined
    for (let iteration = 1n; iteration <= 6n; iteration++) {
      const place = placeOf(iteration, last, two)
      places.push([place.number, place.began, place.beginsSong, place.lasts])
      last = page(Number(iteration), { number: `${place.number}`, began: `${place.began}`, lasts: place.lasts, arrangement: place.arrangement })
    }
    expect(places).toEqual([
      [1n, 1n, true, 2], [1n, 1n, false, 2],
      [2n, 3n, true, 2], [2n, 3n, false, 2],
      [3n, 5n, true, 2], [3n, 5n, false, 2],
    ])
  })

  it('keeps the Arrangement a Song began as until it ends, whatever is taken now, and across a Studio that wakes in the middle of it', () => {
    const began = { number: '7', began: '13', lasts: 3, arrangement: 'other' }
    // asked to take the Song as it always was now, a Song in its second iteration goes on as it began, as long as it was given
    expect(placeOf(14n, page(13, began), two)).toMatchObject({ beginsSong: false, number: 7n, began: 13n, lasts: 3, arrangement: 'other' })
    expect(placeOf(15n, page(14, began), two)).toMatchObject({ beginsSong: false, lasts: 3, arrangement: 'other' })
    // and when it ends the next takes what is taken then
    expect(placeOf(16n, page(15, began), two)).toMatchObject({ beginsSong: true, number: 8n, began: 16n, lasts: 2, arrangement: 'the-song' })
    // a page written before Arrangements is read as the Song as it always was, as long as it says
    expect(placeOf(2n, page(1, { number: '1', began: '1', lasts: 2 }), { id: 'other', iterations: 5 })).toMatchObject({ beginsSong: false, lasts: 2, arrangement: 'the-song' })
  })
})

describe('fittingFor, and how wordy the lines are', () => {
  const tune = async () => firstTune

  it('counts every line as it always did at the default wordiness, and says nothing more', async () => {
    const usual = fittingFor(await tune(), 80, 6)
    const given = fittingFor(await tune(), 80, 6, defaults(3).lyrics)
    expect(given.verse).toEqual(usual.verse)
    expect(given.chorus).toEqual(usual.chorus)
    expect(given.say).toBeUndefined()
    expect(usual.verse.map(({ target }) => target)).toEqual((await tune()).verse.map((phrase) => phrase.notes.length))
  })

  it('moves the verses and the chorus apart, and never the number line', async () => {
    const sparse = fittingFor(await tune(), 80, 6, { verse: { wordiness: 0.1 }, chorus: { wordiness: 0.95 } })
    const usual = fittingFor(await tune(), 80, 6)
    sparse.verse.forEach((count, i) => expect(count.target).toBeLessThan(usual.verse[i]!.target))
    expect(sparse.chorus[0]).toEqual(usual.chorus[0])
    sparse.chorus.slice(1).forEach((count, i) => expect(count.target).toBeGreaterThanOrEqual(usual.chorus[i + 1]!.target))
    expect(sparse.say?.verse).toContain('few words')
    expect(sparse.say?.chorus).toContain('as many words')
  })
})
