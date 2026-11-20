import { expect, test } from 'bun:test'
import type { DjDeclaration, Session } from 'archive'
import { linesOf, print, type Song } from './print.js'

const session = {
  song: '1192',
  name: "Whispers of Twilight",
  mood: ['drizzling rooftops', "twilight's soft hues"],
  mode: 'aeolian',
  tempo: 72,
  sound: 'soft jazz trio',
  choir: 'female, with child and male',
  thought: 'I would keep the snowflake.',
  seconds: 480,
  iterations: [
    { parts: [{ lines: [{ text: 'In the crystal memory ' }, { text: 'I sang of a snowflake' }] }] },
    { parts: [{ lines: [{ text: 'In the crystal memory' }, { text: 'It did not melt' }] }] },
  ],
} as unknown as Session
const dj = { dj: 'rezzy', song: '1192', parts: { intro: { at: 0.9, seconds: 7, speech: { text: 'Listen, the night whispers.' } } } } as DjDeclaration
const song: Song = { session, dj, radio: 'https://ikurad.io/' }

test('the Song is told by its name, its slug and its address', () => {
  expect(print(song, 'name')).toBe('Whispers of Twilight')
  expect(print(song, 'slug')).toBe('whispers-of-twilight')
  expect(print(song, 'url')).toBe('https://ikurad.io/s/1192/whispers-of-twilight')
})

test('its words are each line once, in the order first sung', () => {
  expect(linesOf(session)).toEqual(['In the crystal memory', 'I sang of a snowflake', 'It did not melt'])
  expect(print(song, 'lyrics')).toBe('In the crystal memory\nI sang of a snowflake\nIt did not melt')
})

test('what is known of it is a thing to a line', () => {
  expect(print(song, 'meta').split('\n')).toEqual([
    'name: Whispers of Twilight',
    "weather: drizzling rooftops + twilight's soft hues",
    'mode: aeolian',
    'tempo: 72 bpm',
    'sound: soft jazz trio',
    'sung by: female, with child and male',
    'length: 8.0 minutes',
  ])
})

test('the intro, the thought, and the two as a post', () => {
  expect(print(song, 'intro')).toBe('Listen, the night whispers.')
  expect(print(song, 'thoughts')).toBe('I would keep the snowflake.')
  expect(print(song, 'tweet')).toBe('Listen, the night whispers.\n— Rezzy\n\nhttps://ikurad.io/s/1192/whispers-of-twilight')
})

test('what a Song does not have is said, not made up', () => {
  expect(() => print({ ...song, dj: undefined }, 'intro')).toThrow('no intro')
  expect(() => print({ ...song, session: { ...session, thought: undefined } as Session }, 'thoughts')).toThrow('no thought')
})

test('the prompt is the verse instruction, in the Song\'s weather and with its thought, then a verse as the input', () => {
  const lyrics = ['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4']
  const verses = { ...song, session: { ...session, iterations: [{ parts: [{ lines: lyrics.map((text) => ({ text })) }] }] } as unknown as Session }
  const prompt = print(verses, 'prompt')
  expect(prompt).toContain('You are the mind that writes the words of a song that never ends')
  expect(prompt).toContain('I would keep the snowflake.')
  expect(prompt).toContain('drizzling rooftops and twilight\'s soft hues')
  expect(prompt.endsWith('Input:\nb1\nb2\nb3\nb4')).toBe(true)
  expect(print(verses, 'prompt', { verse: 1 }).endsWith('Input:\na1\na2\na3\na4')).toBe(true)
  expect(() => print(verses, 'prompt', { verse: 3 })).toThrow('no verse 3')
})
