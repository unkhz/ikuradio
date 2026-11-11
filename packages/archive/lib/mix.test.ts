import { describe, expect, it } from 'bun:test'
import { levelOf } from './mix.js'

const db = (gain: number) => Math.round(20 * Math.log10(gain) * 10) / 10

describe('levelOf', () => {
  it('brings every lead line to the same loudness, however it was sung', () => {
    const loud = levelOf({ id: 'a', at: 0, kind: 'voice', loudness: { lufs: -13.6, peak: -2.8 } })
    const quiet = levelOf({ id: 'b', at: 0, kind: 'voice', loudness: { lufs: -21.9, peak: -9.6 } })
    expect(db(loud)).toBe(-2.4)
    expect(db(quiet)).toBe(5.9)
  })

  it('keeps the choir beneath its lead', () => {
    const harmony = levelOf({ id: 'h', at: 0, kind: 'voice', gain: 0.413, loudness: { lufs: -16, peak: -8 } })
    expect(db(harmony)).toBe(-7.7)
  })

  it('lays the Music under the voices', () => {
    const bed = levelOf({ id: 'm', at: 0, kind: 'bed', gain: 0.45, loudness: { lufs: -11, peak: -0.9 } })
    expect(db(bed)).toBe(-11)
  })

  it('raises nothing past the edge, and silence not at all far', () => {
    expect(db(levelOf({ id: 'p', at: 0, kind: 'voice', loudness: { lufs: -24, peak: -2 } }))).toBe(1)
    expect(db(levelOf({ id: 's', at: 0, kind: 'voice', loudness: { lufs: -70, peak: -70 } }))).toBe(12)
  })

  it('plays what was never measured as the Studio said', () => {
    expect(levelOf({ id: 'o', at: 0, kind: 'bed', gain: 0.45 })).toBe(0.45)
  })
})
