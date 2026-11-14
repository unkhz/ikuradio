import { describe, expect, test } from 'bun:test'
import { flow, type Measured } from './flow.js'

// A make-believe page set in letters one unit wide, broken at spaces only
function measured(text: string): Measured {
  const words = text.split(' ')
  return {
    firstWord: words[0]!.length,
    rows(first, width) {
      let count = 1
      let row = 0
      let room = first
      for (const word of words) {
        const wanted = row === 0 ? word.length : row + 1 + word.length
        if (wanted <= room || row === 0 && room === width) row = wanted
        else {
          count++
          row = word.length
          room = width
        }
      }
      return { count, last: row }
    },
  }
}
const set = (lines: string[], width: number, gap = 2) => flow(lines.map(measured), width, gap)

describe('flow', () => {
  test('lines that fit are rows of their own', () => {
    expect(set(['one two', 'three four', 'five six', 'seven'], 20)).toEqual([true, true, true, true])
  })

  test('the line after one that wraps runs on after its short last row', () => {
    // "aaaa bbbb cccc" at 10 wraps to "aaaa bbbb" / "cccc"; "dd" runs on after "cccc", in the 4 left after the gap
    expect(set(['aaaa bbbb cccc', 'dd', 'ff'], 10)).toEqual([false, true, true])
  })

  test('a line running on that wraps again keeps running on', () => {
    expect(set(['aaaa bbbb cccc', 'dd ee ff gg', 'hh'], 10)).toEqual([false, false, true])
  })

  test('where the next first word does not fit after the gap, the line begins its own row', () => {
    // "aaaa bbbb ccccccc" leaves a last row of 7; "dddd" would need 7 + 2 + 4 > 10
    expect(set(['aaaa bbbb ccccccc', 'dddd', 'ee'], 10)).toEqual([false, true, true])
  })

  test('the last line always ends its row', () => {
    expect(set(['aaaa bbbb cccc'], 10)).toEqual([true])
    expect(set([], 10)).toEqual([])
  })
})
