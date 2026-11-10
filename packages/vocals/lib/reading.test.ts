import { describe, it, expect } from 'bun:test'
import { ordinal, readAloud, year } from './reading.js'

describe('readAloud', () => {
  it('reads years as years', () => {
    expect(readAloud('In 2023 we sang')).toBe('In twenty twenty-three we sang')
    expect(readAloud('the summer of 1969')).toBe(
      'the summer of nineteen sixty-nine',
    )
  })

  it('reads counts as counts', () => {
    expect(readAloud('7 stars')).toBe('seven stars')
    expect(readAloud('412 times')).toBe('four hundred and twelve times')
    expect(readAloud('1,000,000 years')).toBe('one million years')
    expect(readAloud('3000 nights')).toBe('three thousand nights')
  })

  it('reads decimals, ordinals and percentages', () => {
    expect(readAloud('3.14 circles')).toBe('three point one four circles')
    expect(readAloud('the 21st night')).toBe('the twenty-first night')
    expect(readAloud('my 3rd heart')).toBe('my third heart')
    expect(readAloud('100% true')).toBe('one hundred percent true')
  })

  it('reads the small signs', () => {
    expect(readAloud('you & me + the sea @ dawn')).toBe(
      'you and me plus the sea at dawn',
    )
  })

  it('leaves words alone', () => {
    expect(readAloud('Welcome to the melody, the rhythm of the night,')).toBe(
      'Welcome to the melody, the rhythm of the night,',
    )
  })
})

describe('year', () => {
  it('says a year the way a year is said', () => {
    expect(year(2000)).toBe('two thousand')
    expect(year(2005)).toBe('two thousand and five')
    expect(year(1900)).toBe('nineteen hundred')
    expect(year(1905)).toBe('nineteen oh five')
  })
})

describe('ordinal', () => {
  it('changes only the last word', () => {
    expect(ordinal('twenty-one')).toBe('twenty-first')
    expect(ordinal('twelve')).toBe('twelfth')
    expect(ordinal('forty')).toBe('fortieth')
    expect(ordinal('one hundred')).toBe('one hundredth')
  })
})
