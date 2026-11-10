import { describe, it, expect } from 'bun:test'
import { numberToWords } from './numbers.js'

describe('song', () => {
  const cases = [
    [0, 'zero'],
    [11, 'eleven'],
    [20, 'twenty'],
    [21, 'twenty-one'],
    [99, 'ninety-nine'],
    [100, 'one hundred'],
    [101, 'one hundred and one'],
    [111, 'one hundred and eleven'],
    [999, 'nine hundred and ninety-nine'],
    [1000, 'one thousand'],
    [1001, 'one thousand, one'],
    [1011, 'one thousand, eleven'],
    [1100, 'one thousand, one hundred'],
    [3312, 'three thousand, three hundred and twelve'],
    [10000, 'ten thousand'],
    [10001, 'ten thousand, one'],
    [
      999999,
      'nine hundred and ninety-nine thousand, nine hundred and ninety-nine',
    ],
    [101_111, 'one hundred and one thousand, one hundred and eleven'],
    [1000000, 'one million'],
    [1000001, 'one million, one'],
    [1000011, 'one million, eleven'],
    [1001000, 'one million, one thousand'],
    [1000111, 'one million, one hundred and eleven'],
    [1001111, 'one million, one thousand, one hundred and eleven'],
    [1011111, 'one million, eleven thousand, one hundred and eleven'],
    [
      1111111,
      'one million, one hundred and eleven thousand, one hundred and eleven',
    ],
    [
      11111111,
      'eleven million, one hundred and eleven thousand, one hundred and eleven',
    ],
    [
      111111111,
      'one hundred and eleven million, one hundred and eleven thousand, one hundred and eleven',
    ],
    [
      8964198726394816,
      'eight quadrillion, nine hundred and sixty-four trillion, one hundred and ninety-eight billion, seven hundred and twenty-six million, three hundred and ninety-four thousand, eight hundred and sixteen',
    ],
  ] as const
  for (const [num, text] of cases) {
    it(`should convert ${num} to "${text}"`, () => {
      expect(numberToWords(BigInt(num))).toEqual(text)
    })
  }
})
