import { describe, expect, it } from 'bun:test'
import { movementsOf, lasts, rezzy, shortest, speak, spokenOf, taken } from '../index.js'

const known = new Map<string, number[]>([
  ['hello', [0, 1]],
  ['there', [1]],
  ['listen', [1, 0]],
  ['the', [0]],
  ['rain', [1]],
  ['is', [0]],
  ['singing', [1, 0]],
])
const words = spokenOf('Hello there, listen, the rain is singing', known)

describe('spokenOf', () => {
  it('reads words, their stress and where a comma falls, and guesses what the dictionary lacks', () => {
    expect(words.map((w) => w.text)).toEqual(['hello', 'there', 'listen', 'the', 'rain', 'is', 'singing'])
    expect(words.map((w) => w.comma)).toEqual([false, true, true, false, false, false, false])
    expect(spokenOf('zorblax', known)[0]!.stresses).toEqual([1, 0])
  })
})

describe('speak', () => {
  it('fits the speech in the seconds it is given, without hurrying a syllable', () => {
    const speech = speak(rezzy, words, 6)!
    expect(lasts(speech)).toBeLessThanOrEqual(6)
    for (const [midi, beats] of speech.notes) if (midi > 0) expect((beats * 60) / speech.bpm).toBeGreaterThanOrEqual(shortest)
  })

  it('says as many words as fit, in order, and stops between words', () => {
    const short = speak(rezzy, words, 2)!
    expect(short.lyrics.split(' ').length).toBeLessThan(words.length)
    expect(words.map((w) => w.text).join(' ').startsWith(short.lyrics)).toBe(true)
  })

  it('says nothing when not even the first word fits', () => {
    expect(speak(rezzy, words, 0.3)).toBeUndefined()
  })

  it('leans on stressed syllables, and the last phrase ends lower than it began', () => {
    const speech = speak(rezzy, words, 8)!
    const pitches = speech.notes.filter(([m]) => m > 0).map(([m]) => m)
    expect(pitches[1]).toBeGreaterThan(pitches[0]!) // hel-LO
    expect(pitches.at(-1)!).toBeLessThan(pitches[pitches.length - 3]! + rezzy.voice.lift)
  })

  it('keeps the voice out of what is said, and puts it to the throat after', () => {
    const speech = speak(rezzy, words, 6)!
    expect(Object.keys(speech).sort()).toEqual(['bpm', 'lyrics', 'notes'])
    expect(taken(rezzy, speech)).toMatchObject({ pressure: rezzy.voice.pressure, tension: rezzy.voice.tension })
  })
})

describe('movementsOf', () => {
  it('has one movement for each syllable, in time, with the mouth open and the body bobbing where the voice rises', () => {
    const speech = speak(rezzy, words, 8)!
    const moves = movementsOf(speech, rezzy.movements)
    expect(moves.length).toBe(speech.notes.filter(([m]) => m > 0).length)
    expect(moves.every((m, i) => i === 0 || m.at > moves[i - 1]!.at)).toBe(true)
    expect(Math.max(...moves.map((m) => m.bob))).toBeGreaterThan(0)
    expect(Math.min(...moves.map((m) => m.mouth))).toBeGreaterThan(0)
  })
})
