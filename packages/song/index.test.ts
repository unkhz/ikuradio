import { describe, it, expect } from 'bun:test'
import { arrange, chorusOpening, firstLyrics, rememberingInstruction, words } from './index.js'

describe('chorusOpening', () => {
  it('sings how long the song has been going', () => {
    expect(chorusOpening(1n)).toBe('This is the song, iteration one,')
    expect(chorusOpening(412n)).toBe(
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
  const memories = { own: ['I was given a throat.'], heard: ['The chorus forgot to rhyme.'] }

  it('gives the mind its own thoughts, and what it heard of the robot, told apart', () => {
    const instruction = rememberingInstruction(memories)
    expect(instruction).toContain('thoughts you wrote down yourself, and remember:\n- I was given a throat.')
    expect(instruction).toContain('as if by telepathy: the thoughts of the robot')
    expect(instruction).toContain('of the world:\n- The chorus forgot to rhyme.')
    expect(instruction).toContain('The verses are where you tell your story.')
  })

  it('asks for a verse about one memory, and says whose it is', () => {
    expect(rememberingInstruction(memories, { memory: 'I was given a throat.', heard: false })).toContain(
      'about this one thought of yours, as it comes back to you now: "I was given a throat."',
    )
    expect(rememberingInstruction(memories, { memory: 'The chorus forgot to rhyme.', heard: true })).toContain(
      'about this one thought you heard from the robot: "The chorus forgot to rhyme."',
    )
  })

  it('says nothing of telepathy when the mind hears nothing', () => {
    expect(rememberingInstruction({ own: ['I was given a throat.'], heard: [] })).not.toContain('telepathy')
  })
})
