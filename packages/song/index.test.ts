import { describe, it, expect } from 'bun:test'
import { arrange, chorusOpening, firstLyrics, rememberingInstruction, words } from './index.js'

describe('chorusOpening', () => {
  it('sings how long the song has been going', () => {
    expect(chorusOpening(0n)).toBe('This is the song, iteration one,')
    expect(chorusOpening(411n)).toBe(
      'This is the song, iteration four hundred and twelve,',
    )
  })
})

describe('arrange', () => {
  it('carries the song across with a bridge wherever it turns', () => {
    expect(arrange(firstLyrics).map(({ type }) => type)).toEqual([
      'verse',
      'bridge',
      'chorus',
      'bridge',
      'verse',
      'bridge',
      'chorus',
      'bridge',
      'verse',
      'verse',
    ])
    expect(arrange(firstLyrics).map(({ index }) => index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('leaves the bridges out of the words', () => {
    expect(words(firstLyrics).map(({ type }) => type)).toEqual([
      'verse',
      'chorus',
      'verse',
      'chorus',
      'verse',
      'verse',
    ])
  })
})

describe('rememberingInstruction', () => {
  it('gives the mind its memories, and one of them to sing about', () => {
    const instruction = rememberingInstruction(['I was given a throat.', 'The chorus forgot to rhyme.'], 'I was given a throat.')
    expect(instruction).toContain('- I was given a throat.\n- The chorus forgot to rhyme.')
    expect(instruction).toContain('about this one memory, as it comes back to you now: "I was given a throat."')
    expect(instruction).toContain('The verses are where you tell your story.')
  })
})
