import { hum } from './perform.js'

describe('hum', () => {
  it('gives every note of the tune its own ooh', () => {
    expect(hum(3)).toBe('ooh ooh ooh')
    expect(hum(9).split(' ')).toHaveLength(9)
  })
})
