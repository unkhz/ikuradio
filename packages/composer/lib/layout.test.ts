import { describe, expect, it } from 'bun:test'
import { firstTune, phraseBeats } from 'melody'
import { ending, placesOf, readArrangements, readParts } from 'parts'
import { layoutOf } from './layout.js'

const records = await readParts()
const parts = new Map(records.map(({ part }) => [part.id, part]))
const theSong = (await readArrangements(records)).find(({ arrangement }) => arrangement.id === 'the-song')!.arrangement
const layout = layoutOf(theSong, parts, firstTune, 72)
const sum = (phrases: readonly Parameters<typeof phraseBeats>[0][]) => phrases.reduce((total, phrase) => total + phraseBeats(phrase), 0)

describe('the Song laid out at 72 bpm', () => {
  it('has its twenty instances, in order: the Song walks its whole order twice', () => {
    expect(layout.instances.map(({ name }) => name)).toEqual(theSong.instances.map(({ name }) => name))
    expect(layout.instances.map(({ index }) => index)).toEqual([...Array(20).keys()])
  })

  it('lasts 16 beats for each bridge', () => {
    for (const placed of layout.instances.filter(({ part }) => part === 'bridge')) expect(placed.beats).toBe(16)
  })

  it('lasts, for each written part, as long as its phrases', () => {
    for (const placed of layout.instances.filter(({ part }) => part === 'verse')) expect(placed.beats).toBe(sum(firstTune.verse))
    for (const placed of layout.instances.filter(({ part }) => part === 'chorus')) expect(placed.beats).toBe(sum(firstTune.chorus))
  })

  it('marks the parts that may grow with the Song\'s age: the chorus, and none of the others', () => {
    expect(layout.instances.filter(({ grows }) => grows).map(({ part }) => part)).toEqual(['chorus', 'chorus', 'chorus', 'chorus'])
  })

  it('has its starts add up, with no gaps', () => {
    let at = 0
    for (const placed of layout.instances) {
      expect(placed.start).toBe(at)
      at += placed.beats
    }
    expect(layout.beats).toBe(at)
    expect(layout.seconds).toBeCloseTo((at * 60) / 72, 9)
    for (const placed of layout.instances) expect(placed.seconds).toBeCloseTo((placed.beats * 60) / 72, 9)
  })

  it('shares words by name within an iteration only: the choruses 3 and 7, and 13 and 17, but not 3 and 13', () => {
    const at = (n: number) => layout.instances[n - 1]!
    expect(at(3).heardAgain).toEqual([at(7).index])
    expect(at(7).heardAgain).toEqual([at(3).index])
    expect(at(13).heardAgain).toEqual([at(17).index])
    expect(at(17).heardAgain).toEqual([at(13).index])
    // a name heard once in an iteration shares with nothing
    expect(layout.instances.filter(({ name }) => name !== 'chorus').every(({ heardAgain }) => heardAgain.length === 0)).toBe(true)
    expect(layout.instances.map(({ iteration }) => iteration)).toEqual([...Array(10).fill(0), ...Array(10).fill(1)])
  })

  it('has what is heard again after the turn continue the same name before it, not share its words', () => {
    const at = (n: number) => layout.instances[n - 1]!
    expect(at(1).continues).toBeUndefined()
    expect(at(11).continues).toBe(0)
    expect(at(1).heardAgain).toEqual([])
    expect(at(11).heardAgain).toEqual([])
    // the second chorus of the second iteration follows the nearest one before the turn: the latter
    expect(at(13).continues).toBe(6)
    expect(at(17).continues).toBe(6)
    expect(layout.instances.slice(0, 10).every(({ continues }) => continues === undefined)).toBe(true)
    expect(layout.instances.slice(10).every(({ continues }) => continues !== undefined)).toBe(true)
  })

  it('has the endings and neighbours step 2 proved', () => {
    const places = placesOf(theSong, 1n)
    for (const placed of layout.instances) {
      expect(placed.ending).toBe(ending(parts.get(placed.part)!, places[placed.index]!))
      expect(placed.before).toBe(places[placed.index]!.before)
      expect(placed.after).toBe(places[placed.index]!.after)
    }
    expect(layout.instances.at(-1)!.ending).toBe('full')
  })

  it('is slower in seconds at a slower tempo, and the same in beats', () => {
    const slow = layoutOf(theSong, parts, firstTune, 36)
    expect(slow.beats).toBe(layout.beats)
    expect(slow.seconds).toBeCloseTo(layout.seconds * 2, 9)
  })

  it('says plainly when an instance names a part that is not there', () => {
    expect(() => layoutOf({ id: 'x', title: 'X', instances: [{ name: 'a', part: 'unknown-part' }] }, parts, firstTune, 72)).toThrow('there is no part "unknown-part"')
  })
})

describe('continuing another name', () => {
  it('points at the nearest instance of the name it says, before it, and follows nothing by its own name', () => {
    const named = { id: 'x', title: 'X', instances: [{ name: 'a', part: 'verse' }, { name: 'b', part: 'chorus' }, { name: 'c', part: 'verse', continues: 'a' }] } as never
    const placed = layoutOf(named, parts, firstTune, 72).instances
    expect(placed.map(({ continues }) => continues)).toEqual([undefined, undefined, 0])
    expect(placed.map(({ iteration }) => iteration)).toEqual([0, 0, 0])
  })
})
