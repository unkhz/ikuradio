import { describe, expect, it } from 'bun:test'
import { readArrangements, readParts, readTracks } from '../index.js'
import { fieldsOf } from './words.js'

const records = await readParts()
const tracks = await readTracks()
const arrangements = await readArrangements(records, undefined, tracks)
const arrangementOf = (id: string) => arrangements.find(({ arrangement }) => arrangement.id === id)!.arrangement

describe('fieldsOf — words by name, never by position', () => {
  it('maps bridgeless and reordered Arrangements by name against the-song by default', () => {
    const reordered = [
      { name: 'chorus' },
      { name: 'verse-1' },
      { name: 'verse-2' },
      { name: 'chorus' },
      { name: 'verse-3' },
      { name: 'final-chorus' },
    ]
    expect(fieldsOf(reordered)).toEqual(['chorus', 'firstVerse', 'secondVerse', 'chorus', 'thirdVerse', 'finalChorus'])
  })

  it('maps tempo-turns by name, giving verse-2 secondVerse even though it sits at index 6', () => {
    const turns = arrangementOf('tempo-turns')
    expect(fieldsOf(turns.instances)).toEqual(['firstVerse', undefined, 'chorus', undefined, 'chorus', undefined, 'secondVerse'])
  })

  it('follows continues chains and gives unknown names nothing', () => {
    const custom = [
      { name: 'verse-1' },
      { name: 'verse-1-encore', continues: 'verse-1' },
      { name: 'coda' },
    ]
    expect(fieldsOf(custom)).toEqual(['firstVerse', 'firstVerse', undefined])
  })
})
