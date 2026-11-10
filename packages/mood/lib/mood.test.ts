import { describe, it, expect } from 'bun:test'
import { settle } from './character.js'
import { isWeather, resembles } from './forecast.js'
import { nextMood } from '../index.js'

describe('settle', () => {
  it('lets the tempo walk, not leap', () => {
    expect(settle(130, 76)).toBe(92)
    expect(settle(40, 76)).toBe(60)
    expect(settle(80, 76)).toBe(80)
  })

  it('keeps the tempo singable', () => {
    expect(settle(200, 130)).toBe(132)
    expect(settle(10, 60)).toBe(56)
  })
})

describe('isWeather', () => {
  it('accepts a few plain words', () => {
    expect(isWeather('lighthouse at low tide', [])).toBe(true)
    expect(isWeather("a sailor's lament", [])).toBe(true)
    expect(isWeather('drömmar om snö', [])).toBe(true)
  })

  it('refuses sentences, lists, markup and what the song has just had', () => {
    expect(
      isWeather('the sea, the sky, and everything we ever lost in them', []),
    ).toBe(false)
    expect(isWeather('dub, reggae; and jazz.', [])).toBe(false)
    expect(isWeather('<b>dub</b>', [])).toBe(false)
    expect(isWeather('', [])).toBe(false)
    expect(isWeather('First Snow', ['first snow'])).toBe(false)
  })
})

describe('resembles', () => {
  it('hears the same weather in different words', () => {
    expect(
      resembles('whispers of a distant shore', 'a whisper of distant shores'),
    ).toBe(true)
    expect(resembles('first snow', 'the first snows')).toBe(true)
  })

  it('tells different weather apart, even when it shares a word', () => {
    expect(
      resembles(
        'echoes of a distant lullaby',
        'whispers of a forgotten lullaby',
      ),
    ).toBe(false)
    expect(
      resembles(
        'a ghostly echo in the wind',
        'rain-soaked whispers in the wind',
      ),
    ).toBe(false)
    expect(resembles('dub', 'desert blues')).toBe(false)
  })
})

describe('nextMood without the mind', () => {
  const previous = {
    descriptions: ['eternity', 'dub'],
    character: { mode: 'aeolian' as const, tempo: 76 },
    remembered: ['spring', 'death'],
  }

  it('lets the oldest go, remembers it, and draws something it has not had lately', async () => {
    for (let i = 0; i < 20; i++) {
      const next = await nextMood(previous, 2, {
        mind: false,
        random: Math.random,
      })
      expect(next.descriptions[0]).toBe('dub')
      expect(['eternity', 'spring', 'death', 'dub']).not.toContain(
        next.descriptions[1],
      )
      expect(next.remembered).toEqual(['spring', 'death', 'eternity'])
    }
  })

  it('remembers only so much', async () => {
    const long = {
      ...previous,
      remembered: Array.from({ length: 12 }, (_, i) => `w${i}`),
    }
    const next = await nextMood(long, 2, { mind: false })
    expect(next.remembered).toHaveLength(12)
    expect(next.remembered?.at(-1)).toBe('eternity')
  })
})
