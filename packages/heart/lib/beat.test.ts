import { describe, expect, it } from 'bun:test'
import { liveReached, waitingAfter } from './beat.js'

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

describe('liveReached', () => {
  it('is the next Song if it is live, else the one playing', () => {
    expect(liveReached({ playing: { song: '5' }, next: { song: '6' } })).toBe('6')
    expect(liveReached({ playing: { song: '5' }, next: null })).toBe('5')
  })

  it('is never an encore\'s number, which says nothing of how far the live show has come', () => {
    expect(liveReached({ playing: { song: '300', mode: 'encore' }, next: null })).toBeUndefined()
    expect(liveReached({ playing: { song: '300', mode: 'encore' }, next: { song: '1182' } })).toBe('1182')
    expect(liveReached({ playing: { song: '5' }, next: { song: '300', mode: 'encore' } })).toBe('5')
  })
})
