import { describe, expect, it } from 'bun:test'
import { chordsHeard, composeGuide, type TimedSyllable, type TwoVoiceGuide } from './guide.js'
import { harmonizeChoir, keyFor, type Score } from '../index.js'
import { degreeToMidi } from './scale.js'
import { modes } from './scale.js'
import { wrongness } from './wrongness.js'

const dorian = modes.dorian
/** A guide of three chords, i, IV and v, two bars each, by hand. */
const guide: TwoVoiceGuide = {
  beats: 24,
  chords: [
    { at: 0, beats: 8, root: 0, bass: -7, upper: 2, function: 'home' },
    { at: 8, beats: 8, root: 3, bass: -4, upper: 5, function: 'away' },
    { at: 16, beats: 8, root: 4, bass: -3, upper: 6, function: 'tension' },
  ],
  lower: [],
  upper: [],
  furthest: 1,
}

describe('chordsHeard', () => {
  it('gives the triad sounding at a beat of the line, in pitch classes on A', () => {
    const heard = chordsHeard(guide, dorian, { offset: 0, bpm: 80, lineBpm: 80 })
    // A dorian: i is A C E, IV is D F# A, v is E G B
    expect(heard(0)).toEqual([9, 0, 4])
    expect(heard(9)).toEqual([2, 6, 9])
    expect(heard(23)).toEqual([4, 7, 11])
  })

  it('counts from where the line begins in its section, at the guide tempo', () => {
    expect(chordsHeard(guide, dorian, { offset: 8, bpm: 80, lineBpm: 80 })(0)).toEqual([2, 6, 9])
    // a line kept at twice the tempo: its beat 16 is the guide beat 8
    expect(chordsHeard(guide, dorian, { offset: 0, bpm: 80, lineBpm: 160 })(16)).toEqual([2, 6, 9])
  })
})

describe('the choir over the guide', () => {
  it('sings more of its notes on the guide chord tones when it hears them', () => {
    const key = keyFor('female', 'dorian')
    let heardOn = 0
    let deafOn = 0
    let all = 0
    for (let seed = 0; seed < 20; seed++) {
      const random = wrongness(`choir:${seed}`)
      // a lead walking over the section, a note a beat
      const notes: [number, number][] = Array.from({ length: 24 }, () => [degreeToMidi(Math.floor(random() * 8), key), 1])
      const syllables: TimedSyllable[] = notes.map((_, i) => ({ at: i, beats: 1, stress: i % 2 ? 0 : 1, begins: true, comma: false, lineEnd: i === 23 }))
      const composed = composeGuide({ syllables, beats: 24, bpm: 80, mode: dorian, ending: 'full', random: wrongness(`g:${seed}`) })
      const lead: Score = { bpm: 80, lyrics: '', notes }
      const chords = chordsHeard(composed, dorian, { offset: 0, bpm: 80, lineBpm: 80 })
      const sing = (withChords: boolean) =>
        harmonizeChoir({
          lead,
          leadKey: key,
          frame: key,
          keyOf: (body) => keyFor(body, 'dorian'),
          voices: [{ body: 'female', harmony: -2 }, { body: 'male', harmony: -4 }],
          harmony: { style: 'voiced', placement: 'below', above: 2, spread: 1 },
          random: wrongness(`h:${seed}`),
          ...(withChords ? { chords } : {}),
        })
      const onChord = (voices: Score[]) =>
        voices.flatMap((v) => v.notes.map(([m], i) => (m > 0 && chords(i)!.includes(m % 12) ? 1 : 0))).reduce<number>((a, b) => a + b, 0)
      heardOn += onChord(sing(true))
      deafOn += onChord(sing(false))
      all += 2 * notes.length
    }
    if (process.env.SHOW) console.log(`on the chord: ${(heardOn / all).toFixed(2)} hearing it, ${(deafOn / all).toFixed(2)} without`)
    expect(heardOn / all).toBeGreaterThan(deafOn / all + 0.1)
    expect(heardOn / all).toBeGreaterThan(0.7)
  })
})
