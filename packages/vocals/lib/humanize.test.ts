import { describe, it, expect } from 'bun:test'
import type { Score } from 'melody'
import { humanize, wrongness } from './humanize.js'
import { gather, firstChoir, introduce, throatOf } from './singers.js'

const score: Score = {
  bpm: 76,
  lyrics: 'This is the song, iteration one,',
  notes: [
    [64, 0.5],
    [64, 0.5],
    [64, 0.5],
    [65, 1],
    [64, 0.5],
    [62, 0.5],
    [60, 0.5],
    [59, 0.5],
    [57, 2],
    [0, 1.5],
  ],
}

const beats = (s: Score) => s.notes.reduce((sum, [, b]) => sum + b, 0)

describe('humanize', () => {
  it('is the same take for the same name', () => {
    expect(humanize(score, 'a')).toEqual(humanize(score, 'a'))
  })

  it('is another take for another name', () => {
    expect(humanize(score, 'a')).not.toEqual(humanize(score, 'b'))
  })

  it('never moves a note far enough to change the tune', () => {
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      humanize(score, name).notes.forEach(([midi], i) => {
        expect(Math.abs(midi - score.notes[i][0])).toBeLessThan(0.14)
      })
    }
  })

  it('never moves the bar lines', () => {
    for (const name of ['a', 'b', 'c']) {
      const take = humanize(score, name)
      expect(beats(take)).toBeCloseTo(beats(score), 10)
      expect(take.notes.at(-1)).toEqual([0, 1.5])
      expect(take.notes.every(([, b]) => b > 0)).toBe(true)
    }
  })
})

describe('wrongness', () => {
  it('stays between zero and one', () => {
    const random = wrongness('x')
    for (let i = 0; i < 1000; i++) {
      const r = random()
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
    }
  })
})

describe('gather', () => {
  it('puts the lead first, singing the tune at full voice', () => {
    const [lead, ...rest] = gather(3, wrongness('choir'))
    expect(lead.harmony).toBe(0)
    expect(lead.gain).toBe(1)
    expect(rest.map((v) => v.harmony)).toEqual([-2, -4])
  })

  it('can be a single voice', () => {
    expect(gather(1)).toHaveLength(1)
  })

  it('introduces itself', () => {
    expect(introduce(firstChoir)).toBe('female, with child and male')
  })
})

describe('throatOf', () => {
  it('gives every singer a throat near how Chimera sings by default', () => {
    const random = wrongness('throats')
    for (let i = 0; i < 200; i++) {
      const { pressure, tension, breathiness } = throatOf(random)
      expect(pressure).toBeGreaterThanOrEqual(7.5)
      expect(pressure).toBeLessThanOrEqual(10.5)
      expect(tension).toBeGreaterThanOrEqual(0.45)
      expect(tension).toBeLessThanOrEqual(0.65)
      expect(breathiness).toBeGreaterThanOrEqual(0.08)
      expect(breathiness).toBeLessThanOrEqual(0.25)
    }
  })

  it('gives each singer in a new choir a throat of their own', () => {
    const choir = gather(3, wrongness('choir'))
    expect(choir.every(({ throat }) => throat !== undefined)).toBe(true)
    expect(new Set(choir.map(({ throat }) => JSON.stringify(throat))).size).toBe(3)
  })
})
