import { describe, it, expect } from 'bun:test'
import { chorusOpening } from './index.js'

describe('chorusOpening', () => {
  it('sings how long the song has been going', () => {
    expect(chorusOpening(0n)).toBe('This is the song, iteration one,')
    expect(chorusOpening(411n)).toBe(
      'This is the song, iteration four hundred and twelve,',
    )
  })
})
