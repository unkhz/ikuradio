import { describe, expect, it } from 'bun:test'
import { cutTo, factsInput, sensibly, speakingInstruction, spokenPlainly, writeSpeech, type Facts } from './speeches.js'

const rezzy = { title: 'Rezzy', persona: 'Rezzy is a critter.' }
const facts: Facts = { name: 'A thaw, slow', weather: ['snow', 'gears'], sound: 'low strings', mode: 'dorian', tempo: 60, lyrics: ['The ice lets go,', 'a drop at a time.'], thought: 'I wondered what silence hears.' }
/** A syllable for every two letters: close enough to make a text long or short. */
const count = async (text: string) => Math.ceil(text.replace(/[^a-z]/gi, '').length / 2)
const words = (n: number) => `${Array.from({ length: n }, () => 'ab').join(' ')}.`
const noWait = async () => {}

describe('what the mind is given', () => {
  it('is what the DJ has read of the Song: its name, its words, its weather, its sound, and its mind\'s thought', () => {
    const input = factsInput(facts)
    expect(input).toContain('Its words, a line at a time:\nThe ice lets go,\na drop at a time.')
    expect(input).toContain('Name: A thaw, slow')
    expect(input).toContain('Weather: snow and gears')
    expect(input).toContain('Sound: low strings')
    expect(input).toContain('dorian, 60 beats a minute')
    expect(input).toContain("What the song's mind thought of it, when it wrote it: I wondered what silence hears.")
    expect(factsInput({ ...facts, sound: undefined, thought: undefined, lyrics: undefined })).not.toContain('Sound')
  })

  it('tells the mind who it is: the DJ, who did not write the Song, has read what it makes public, and puts their own touch to the introduction', () => {
    const told = speakingInstruction(rezzy)
    expect(told).toContain('You are Rezzy. Rezzy is a critter.')
    expect(told).toContain('You did not write this one')
    expect(told).toContain('what it makes public')
    expect(told).toContain('in your own words and your own touch')
    expect(told).toContain('do not speak as the song\'s mind')
  })

  it('is asked for a speech of a sensible length for fifteen seconds, and told how the last try missed', () => {
    expect(speakingInstruction(rezzy)).toContain('About 30 to 42 syllables')
    expect(speakingInstruction(rezzy, sensibly, 'long')).toContain('too long')
    expect(speakingInstruction(rezzy, sensibly, 'short')).toContain('too short')
  })
})

describe('spokenPlainly', () => {
  it('leaves plain words, and takes out what the throat cannot say', () => {
    expect(spokenPlainly('"Hello there, friend!" *waves* 🐾 It\'s 3 am.')).toBe("Hello there, friend! waves It's am.")
  })
})

describe('cutTo', () => {
  it('keeps whole sentences that fit, and none that do not', async () => {
    const text = `${words(10)} ${words(10)} ${words(10)}`
    const cut = await cutTo(text, 25, count)
    expect(cut).toBe(`${words(10)} ${words(10)}`)
  })

  it('cuts at a word when not even the first sentence fits', async () => {
    const cut = await cutTo(words(40), 10, count)
    expect(await count(cut)).toBeLessThanOrEqual(10)
    expect(cut.endsWith('.')).toBe(true)
  })
})

describe('writeSpeech', () => {
  const asking = (speeches: string[]) => {
    const seen: string[] = []
    const asker = (async ({ instruction }: { instruction: string }) => (seen.push(instruction), { speech: speeches.shift()! })) as never
    return { asker, seen }
  }

  it('gives a speech of a sensible length as it is', async () => {
    const good = words(30)
    expect(await writeSpeech(rezzy, facts, { asker: asking([good]).asker, count, sleep: noWait })).toBe(good)
  })

  it('asks again, shorter, when it is too long, and takes the one that fits', async () => {
    const { asker, seen } = asking([words(60), words(30)])
    expect(await writeSpeech(rezzy, facts, { asker, count, sleep: noWait })).toBe(words(30))
    expect(seen).toHaveLength(2)
    expect(seen[1]).toContain('too long')
  })

  it('cuts the closest at a sentence when every try is too long', async () => {
    const long = `${words(30)} ${words(30)} ${words(30)}`
    const got = (await writeSpeech(rezzy, facts, { asker: asking([long, long, long]).asker, count, sleep: noWait }))!
    expect(await count(got)).toBeLessThanOrEqual(sensibly.most)
    expect(got.endsWith('.')).toBe(true)
  })

  it('gives none when it is too short to be anything', async () => {
    expect(await writeSpeech(rezzy, facts, { asker: asking([words(2), words(2), words(2)]).asker, count, sleep: noWait })).toBeUndefined()
  })

  it('still gives a short one that is something', async () => {
    const short = words(12)
    expect(await writeSpeech(rezzy, facts, { asker: asking([short, short, short]).asker, count, sleep: noWait })).toBe(short)
  })
})
