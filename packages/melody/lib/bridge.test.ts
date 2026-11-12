import { describe, expect, it } from 'bun:test'
import { journey } from './bridge.js'
import { degreeToMidi, modes } from './scale.js'
import { chorusHook, verseWalk } from './hooks.js'

const key = { tonic: 57, mode: modes.aeolian }
const midi = (degree: number) => degreeToMidi(degree, key)
const total = (notes: [number, number][]) => notes.reduce((sum, [, b]) => sum + b, 0)
const longest = (notes: [number, number][]) => Math.max(...notes.map(([, b]) => b))

describe('journey', () => {
  const intoChorus = journey({ from: verseWalk.at(-1)!, fromKey: key, to: chorusHook[0], toKey: key, beats: 16 })
  const intoVerse = journey({ from: chorusHook.at(-1)!, fromKey: key, to: verseWalk[0], toKey: key, beats: 16 })

  it('lasts the whole bridge', () => {
    expect(total(intoChorus)).toBe(16)
    expect(total(intoVerse)).toBe(16)
  })

  it('is music, not a note held: it moves in every bar', () => {
    for (const notes of [intoChorus, intoVerse]) {
      expect(notes.length).toBeGreaterThanOrEqual(10)
      expect(longest(notes)).toBeLessThanOrEqual(4)
    }
  })

  it('moves even between parts that end and begin on the same note', () => {
    // the chorus ends on the tonic and the verse begins on it
    expect(new Set(intoVerse.map(([m]) => m)).size).toBeGreaterThanOrEqual(5)
  })

  it('begins with a farewell: the cadence the part before ended on', () => {
    expect(intoChorus.slice(0, 3).map(([m]) => m)).toEqual([-1, -2, 0].map(midi))
    expect(intoVerse.slice(0, 3).map(([m]) => m)).toEqual([1, 2, 0].map(midi))
  })

  it('foreshadows the head of the coming part somewhere it is not, then nearer', () => {
    // the chorus begins 4 5 4 3: heard a fourth below, then a step below
    expect(intoChorus.slice(3, 7).map(([m]) => m)).toEqual([1, 2, 1, 0].map(midi))
    expect(intoChorus.slice(7, 11).map(([m]) => m)).toEqual([3, 4, 3, 2].map(midi))
    // the verse begins 0 1 2 1: heard a fifth above, then a third above
    expect(intoVerse.slice(3, 7).map(([m]) => m)).toEqual([4, 5, 6, 5].map(midi))
    expect(intoVerse.slice(7, 11).map(([m]) => m)).toEqual([2, 3, 4, 3].map(midi))
  })

  it('ends leaning on the step beside the coming first note, for the part to resolve', () => {
    expect(intoChorus.at(-1)![0]).toBe(midi(3))
    expect(intoVerse.at(-1)![0]).toBe(midi(1))
    expect(intoChorus.at(-1)![1]).toBe(2)
  })

  it('leads into a new key when the part to come is in one', () => {
    const lydian = { tonic: 57, mode: modes.lydian }
    const into = journey({ from: verseWalk.at(-1)!, fromKey: key, to: chorusHook[0], toKey: lydian, beats: 16 })
    const tones = new Set(Array.from({ length: 36 }, (_, d) => degreeToMidi(d - 14, lydian)))
    expect(into.slice(3).every(([m]) => tones.has(m))).toBe(true)
  })

  it('keeps its shape when it is longer or shorter', () => {
    const long = journey({ from: verseWalk.at(-1)!, fromKey: key, to: chorusHook[0], toKey: key, beats: 24 })
    expect(total(long)).toBe(24)
    expect(long.map(([m]) => m)).toEqual(intoChorus.map(([m]) => m))
  })
})
