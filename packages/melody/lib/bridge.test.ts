import { describe, expect, it } from 'bun:test'
import { journey } from './bridge.js'
import { degreeToMidi, modes } from './scale.js'
import { chorusHook, verseWalk } from './hooks.js'

const key = { tonic: 57, mode: modes.aeolian }

describe('journey', () => {
  const from = verseWalk.at(-1)!
  const to = chorusHook[0]
  const notes = journey({ from, fromKey: key, to, toKey: key, beats: 16 })

  it('lasts the whole bridge', () => {
    expect(notes.reduce((sum, [, b]) => sum + b, 0)).toBe(16)
  })

  it('begins with the echo of where the part before ended', () => {
    const [first] = notes
    expect(first[0]).toBe(degreeToMidi(from.notes[0][0], key))
  })

  it('arrives on the first note of the part to come', () => {
    expect(notes.at(-1)![0]).toBe(degreeToMidi(to.notes[0][0], key))
  })

  it('walks through the coming key, and only through it', () => {
    const tones = new Set(Array.from({ length: 36 }, (_, d) => degreeToMidi(d - 14, key)))
    expect(notes.every(([midi]) => tones.has(midi))).toBe(true)
  })

  it('arrives in a new key when the part to come is in one', () => {
    const lydian = { tonic: 57, mode: modes.lydian }
    const into = journey({ from, fromKey: key, to, toKey: lydian, beats: 16 })
    expect(into.at(-1)![0]).toBe(degreeToMidi(to.notes[0][0], lydian))
  })
})
