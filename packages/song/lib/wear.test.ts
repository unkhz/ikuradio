import { describe, expect, it } from 'bun:test'
import { leansOn, worn } from './wear.js'

const verses = [
  "Beneath the moon's soft glow, our hearts entwine,\nIn love's embrace, a love divine.",
  'Our hearts beat on, the violins sing of love,\nAs shadows dance beneath the stars above.',
  'The violins weep, our hearts in time.',
]

describe('worn', () => {
  it('finds the words the verses leaned on most', () => {
    expect(worn(verses, ['eternity', 'romantic chamber music with violin and cello'])).toEqual([
      'hearts',
      'love',
      'beneath',
    ])
  })

  it('never rests the words of the Mood', () => {
    expect(worn(verses, ['love songs', 'violins'])).not.toContain('love')
    expect(worn(verses, ['love songs', 'violins'])).not.toContain('violins')
  })

  it('rests only so many', () => {
    expect(worn(verses, [], 2)).toEqual(['hearts', 'love'])
  })
})

describe('leansOn', () => {
  it('counts the resting words a verse uses anyway', () => {
    expect(leansOn(['Our hearts, our love,', 'a love supreme'], ['love', 'hearts'])).toBe(3)
    expect(leansOn(['Radio static between stations'], ['love'])).toBe(0)
  })
})
