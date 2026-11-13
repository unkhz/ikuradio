import { describe, it, expect } from 'bun:test'
import { wrongness } from 'melody'
import { hum, scat } from './perform.js'

describe('hum', () => {
  it('gives every note of the tune its own ooh', () => {
    expect(hum(3)).toBe('ooh ooh ooh')
    expect(hum(9).split(' ')).toHaveLength(9)
  })
})

describe('scat', () => {
  it('sings a syllable a note, never the same one twice in a row, the same for the same bridge', () => {
    const sung = scat(['doo', 'wop', 'bah', 'dap'], wrongness('scat:1:3'))(12).split(' ')
    expect(sung).toHaveLength(12)
    for (let i = 1; i < sung.length; i++) expect(sung[i]).not.toBe(sung[i - 1])
    expect(new Set(sung).size).toBeGreaterThan(2)
    expect(scat(['doo', 'wop', 'bah', 'dap'], wrongness('scat:1:3'))(12)).toBe(sung.join(' '))
  })

  it('sings one syllable over and over, if it has only one', () => {
    expect(scat(['doo'], wrongness('one'))(3)).toBe('doo doo doo')
  })
})
