import { describe, expect, it } from 'bun:test'
import { band, echoesMood } from './character.js'

describe('echoesMood', () => {
  const mood = ['romantic chamber music with violin and cello', 'gregorian chant']

  it('hears the Mood handed back as its own sound', () => {
    expect(echoesMood('romantic chamber music with violin and cello + gregorian chant', mood)).toBe(true)
    expect(echoesMood('', mood)).toBe(true)
  })

  it('lets a band through that the mind truly heard', () => {
    expect(echoesMood('medieval pipe organ and a lone, deep timpani roll', ['gregorian chant', 'death'])).toBe(false)
    expect(echoesMood('a cello drone under monks in a stone hall', mood)).toBe(false)
  })
})

describe('band', () => {
  it('ends on a whole word, not cut off', () => {
    expect(
      band('fuzzed-out wah-wah guitar licks, groovy basslines, and funky drum breaks interspersed with'),
    ).toBe('fuzzed-out wah-wah guitar licks, groovy basslines, and funky drum breaks')
    expect(
      band('dusty desert blues guitar and hand drums, with a melancholic violin and subtle, low-key c\u0e44'),
    ).toBe('dusty desert blues guitar and hand drums, with a melancholic violin and subtle, low-key')
  })

  it('lets go of a word the mind was cut off in', () => {
    expect(band('soft synth pads and a low c\u0e44')).toBe('soft synth pads and a low')
  })

  it('says no more than a musician would', () => {
    expect(band('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen').split(' ')).toHaveLength(14)
  })
})
