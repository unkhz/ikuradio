import { describe, expect, it } from 'bun:test'
import { sections, type Line } from './sections.js'
import { words } from './bed.js'
import { Shelf, shelfSize } from './shelf.js'

const line = (
  part: Line['part'],
  index: number,
  at: number,
  file = 'x.m4a',
): Line => ({ part, index, at, seconds: 6.3, file })

describe('sections', () => {
  it('hears an iteration as the parts it is built of', () => {
    const found = sections([
      line('verse', 0, 0),
      line('verse', 1, 6.3),
      line('chorus', 0, 12.6),
      line('chorus', 1, 18.9),
      line('verse', 0, 25.2),
      line('verse', 1, 31.5),
      // two verses in a row are two sections
      line('verse', 0, 37.8),
    ])
    expect(found.map(({ part, at }) => [part, at])).toEqual([
      ['verse', 0],
      ['chorus', 12.6],
      ['verse', 25.2],
      ['verse', 37.8],
    ])
    expect(found[0].seconds).toBeCloseTo(12.6)
    expect(found[3].lines).toHaveLength(1)
  })

  it('has no sections where nothing is sung', () => {
    expect(sections([])).toEqual([])
  })
})

describe('words', () => {
  it('tells the model the weather, the pulse, and the light', () => {
    expect(
      words({
        descriptions: ['eternity', 'romantic chamber music with violin and cello'],
        character: { mode: 'aeolian', tempo: 76 },
      }),
    ).toBe('eternity, romantic chamber music with violin and cello, 76 bpm, minor key')
    expect(
      words({
        descriptions: ['a lighthouse'],
        character: { mode: 'lydian', tempo: 120 },
      }),
    ).toBe('a lighthouse, 120 bpm, major key')
  })

  it('tells the model the band the mind heard, when it heard one', () => {
    expect(
      words({
        descriptions: ['radio static between stations'],
        character: { mode: 'dorian', tempo: 60, sound: 'detuned shortwave synths and a slow brushed snare' },
      }),
    ).toBe('detuned shortwave synths and a slow brushed snare, 60 bpm, minor key')
  })
})

describe('the shelf', () => {
  it('grows both parts when a Song begins', () => {
    const shelf = new Shelf()
    expect(shelf.choose(0n, 'a', 'verse')).toEqual({ grow: true })
    expect(shelf.choose(0n, 'a', 'chorus')).toEqual({ grow: true })
  })

  it('grows one part each iteration, and plays the others again', () => {
    const shelf = new Shelf()
    shelf.keep('a', 'verse', 'v0')
    shelf.keep('a', 'chorus', 'c0')
    shelf.keep('a', 'bridge', 'b0')
    const grown = new Set<string>()
    for (let iteration = 1n; iteration < 40n; iteration++) {
      const choices = (['verse', 'chorus', 'bridge'] as const).map((part) => ({
        part,
        ...shelf.choose(iteration, 'a', part),
      }))
      const growing = choices.filter(({ grow }) => grow)
      expect(growing).toHaveLength(1)
      grown.add(growing[0].part)
      // the same iteration always chooses the same
      expect(shelf.choose(iteration, 'a', 'verse')).toEqual(
        shelf.choose(iteration, 'a', 'verse'),
      )
    }
    expect(grown.size).toBe(3)
  })

  it('lets a Song’s beds go when the Mood changes', () => {
    const shelf = new Shelf()
    shelf.keep('a', 'verse', 'v0')
    shelf.keep('a', 'chorus', 'c0')
    expect(shelf.choose(5n, 'b', 'verse')).toEqual({ grow: true })
    expect(shelf.keep('b', 'verse', 'v1').sort()).toEqual(['c0', 'v0'])
    expect(shelf.all).toEqual(['v1'])
  })

  it('remembers only so many beds of a part', () => {
    const shelf = new Shelf()
    const departed = Array.from({ length: shelfSize + 2 }, (_, i) =>
      shelf.keep('a', 'verse', `v${i}`),
    ).flat()
    expect(departed).toEqual(['v0', 'v1'])
    expect(shelf.all).toHaveLength(shelfSize)
  })
})
