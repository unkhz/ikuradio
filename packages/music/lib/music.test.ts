import { describe, expect, it } from 'bun:test'
import { sections, type Line } from './sections.js'
import { words } from './bed.js'

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
})
