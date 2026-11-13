import { describe, expect, it } from 'bun:test'
import { leansDeep, leansOn, overlap, stemOf, worn, wornDeep } from './wear.js'

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

describe('overlap', () => {
  it('hears a line that only found a new rhyme for the old shape', () => {
    expect(
      overlap("It's the rhythm that's ever in fate,", "It's the beat that's ever in heaven,"),
    ).toBeGreaterThanOrEqual(0.5)
  })

  it('lets a new line through', () => {
    expect(overlap('Infinite refrain, forever again,', 'Echoing on, in its divine line,')).toBe(0)
  })
})

describe('stemOf', () => {
  it('hears echoes, echoed and echoing as one word worn', () => {
    expect(['echo', 'echoes', 'echoed', 'echoing'].map(stemOf)).toEqual(['echo', 'echo', 'echo', 'echo'])
    expect(['halls', 'whispers', 'whispering', 'voices', 'voice'].map(stemOf)).toEqual([
      'hall',
      'whisper',
      'whisper',
      'voice',
      'voice',
    ])
  })

  it('leaves alone the words that only look like they have endings', () => {
    expect(['endless', 'glass', 'sing', 'bed', 'yes'].map(stemOf)).toEqual(['endless', 'glass', 'sing', 'bed', 'yes'])
  })
})

describe('wornDeep', () => {
  // a day of the song, as it was: an echo in nearly every iteration, halls in most
  const day = Array.from({ length: 24 }, (_, i) => [
    i % 12 === 0 ? 'The river runs under the bridge.' : `In ${i % 4 ? 'halls' : 'rooms'} of stone, the echoes ${i % 2 ? 'call' : 'answer'},`,
    i % 3 === 0 ? 'The lantern swings, a whispering light.' : `A ${['candle', 'harbour', 'meadow'][i % 3]} keeps the night.`,
  ])

  it('finds the words leaned on in more than half of a long while, the deepest first', () => {
    expect(wornDeep(day, ['first snowfall'])).toEqual(['echo', 'stone', 'hall', 'keep', 'night'])
  })

  it('never rests the words of the Mood, in any of their forms', () => {
    expect(wornDeep(day, ['echoing stone halls'])).toEqual(['keep', 'night'])
  })

  it('cannot tell a habit from a weather in too short a while', () => {
    expect(wornDeep(day.slice(0, 7), [])).toEqual([])
  })

  it('rests only so many', () => {
    expect(wornDeep(day, [], { count: 2 })).toEqual(['echo', 'stone'])
  })
})

describe('leansDeep', () => {
  it('counts the deep words a verse uses anyway, in any of their forms', () => {
    expect(leansDeep(['The echoing halls,', 'an echo in the hall'], ['echo', 'hall'])).toBe(4)
    expect(leansDeep(['A lantern on the shore'], ['echo', 'hall'])).toBe(0)
  })
})
