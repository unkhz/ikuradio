import { describe, expect, it } from 'bun:test'
import { favouriteSongs, inTurn } from './favourites.js'

describe('favouriteSongs', () => {
  it('names each Song once, verse before chorus before bridge, a section as its Song', () => {
    const critic = { favorites: { chorus: [7, '45:3'], bridge: ['1', 7], verse: [45, 'nonsense', '9:2'] } }
    expect(favouriteSongs(critic)).toEqual(['45', '9', '7', '1'])
  })
  it('names nothing from a file that names nothing', () => {
    expect(favouriteSongs(undefined)).toEqual([])
    expect(favouriteSongs({ favorites: { verse: 'one' as unknown as number[] } })).toEqual([])
  })
})

describe('inTurn', () => {
  it('begins after the last encore and comes round to it again', () => {
    expect(inTurn(['45', '9', '7'], '9')).toEqual(['7', '45', '9'])
    expect(inTurn(['45', '9', '7'], '7')).toEqual(['45', '9', '7'])
  })
  it('begins at the first with no last, or one that is no longer a favourite', () => {
    expect(inTurn(['45', '9'], undefined)).toEqual(['45', '9'])
    expect(inTurn(['45', '9'], '3')).toEqual(['45', '9'])
  })
})
