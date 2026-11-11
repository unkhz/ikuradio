import { describe, expect, it } from 'bun:test'
import { waitingAfter } from './beat.js'

describe('waitingAfter', () => {
  it('counts the Songs after the one the Radio has reached', () => {
    expect(waitingAfter(['10', '11', '12', '13'], '11')).toBe(2)
  })

  it('counts from the last Song that aired, while the Radio holds its breath', () => {
    // the Archive keeps the words of many Songs for looking back; they are not waiting
    const kept = Array.from({ length: 500 }, (_, i) => `${i}`)
    expect(waitingAfter(kept, '499')).toBe(0)
  })

  it('counts everything when the Radio has never played', () => {
    expect(waitingAfter(['3', '4'], null)).toBe(2)
  })
})
