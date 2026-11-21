import { describe, expect, it } from 'bun:test'
import { firstTune, phraseBeats } from 'melody'
import { ending, placesOf, readArrangements, readParts } from 'parts'
import { layoutOf } from './layout.js'

const records = await readParts()
const parts = new Map(records.map(({ part }) => [part.id, part]))
const theSong = readArrangements(records).find(({ arrangement }) => arrangement.id === 'the-song')!.arrangement
const layout = layoutOf(theSong, parts, firstTune, 72)
const sum = (phrases: readonly Parameters<typeof phraseBeats>[0][]) => phrases.reduce((total, phrase) => total + phraseBeats(phrase), 0)

describe('the Song laid out at 72 bpm', () => {
  it('has its ten instances, in order', () => {
    expect(layout.instances.map(({ name }) => name)).toEqual(theSong.instances.map(({ name }) => name))
    expect(layout.instances.map(({ index }) => index)).toEqual([...Array(10).keys()])
  })

  it('lasts 16 beats for each bridge', () => {
    for (const placed of layout.instances.filter(({ part }) => part === 'bridge')) expect(placed.beats).toBe(16)
  })

  it('lasts, for each written part, as long as its phrases', () => {
    for (const placed of layout.instances.filter(({ part }) => part === 'verse')) expect(placed.beats).toBe(sum(firstTune.verse))
    for (const placed of layout.instances.filter(({ part }) => part === 'chorus')) expect(placed.beats).toBe(sum(firstTune.chorus))
  })

  it('marks the parts that may grow with the Song\'s age: the chorus, and none of the others', () => {
    expect(layout.instances.filter(({ grows }) => grows).map(({ part }) => part)).toEqual(['chorus', 'chorus'])
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

  it('has the two choruses point at each other', () => {
    const [one, other] = layout.instances.filter(({ name }) => name === 'chorus')
    expect(one!.heardAgain).toEqual([other!.index])
    expect(other!.heardAgain).toEqual([one!.index])
    expect(layout.instances.filter(({ name }) => name !== 'chorus').every(({ heardAgain }) => heardAgain.length === 0)).toBe(true)
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
    expect(() => layoutOf({ id: 'x', title: 'X', instances: [{ name: 'a', part: 'refrain' }] }, parts, firstTune, 72)).toThrow('there is no part "refrain"')
  })
})
