import { describe, it, expect } from 'bun:test'
import { clean } from './edit.js'

describe('clean', () => {
  it('lets go of what a small mind leaves in a verse that does not belong in a song', () => {
    expect(clean("Yes, it goes on and on, it's just **knew**")).toBe(
      "Yes, it goes on and on, it's just knew",
    )
    expect(clean('## *A* line with `code`<br>')).toBe('A line with code')
  })

  it('keeps the words themselves', () => {
    expect(clean("don't stop, it's not_over")).toBe("don't stop, it's not_over")
  })
})
