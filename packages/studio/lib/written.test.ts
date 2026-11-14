import { describe, expect, it } from 'bun:test'
import { degreeToMidi, keyFor, modes, vocalRange, type Score } from 'melody'
import { compass, longestRun, sungAs, timedLine, writeSections, type Unwritten } from './written.js'

const bpm = 80
/** A fitted line: notes of the given beats, a rest of two beats after, the words' stresses one a syllable. */
const line = (beats: number[], stresses: number[]): { score: Score; words: { stresses: number[] }[] } => ({
  score: { bpm, lyrics: '', notes: [...beats.map((b): [number, number] => [60, b]), [0, 2]] },
  words: stresses.map((s) => ({ stresses: [s] })),
})
const verse = [
  line([1, 0.5, 0.5, 1, 1, 2], [1, 0, 0, 1, 0, 1]),
  line([0.5, 0.5, 1, 0.5, 0.5, 1, 2], [0, 0, 1, 0, 0, 1, 1]),
  line([1, 1, 0.5, 0.5, 1, 2], [1, 0, 0, 0, 1, 1]),
  line([0.5, 0.5, 1, 1, 1, 2], [0, 0, 1, 0, 1, 1]),
]
const section = (name: string, ending: 'half' | 'full', words = 'a'): Unwritten => ({
  name,
  ending,
  lines: verse.map((fitted, index) => ({ key: `${name.split(':')[0]}:${index}:${words}${index}`, index, fitted })),
})
const lead = { key: keyFor('female', 'dorian'), body: 'female' as const }
const write = (sections: Unwritten[], iteration = 3n, before?: Map<string, never>) =>
  writeSections({ sections, iteration, mode: 'dorian', bpm, lead, sprinkle: 1, pull: 1, before })

describe('compass', () => {
  it('keeps a verse compass within what the body reaches', () => {
    for (const body of ['male', 'female', 'child'] as const) {
      const key = keyFor(body, 'aeolian')
      const [low, high] = compass(key, body)
      expect(degreeToMidi(low, key)).toBeGreaterThanOrEqual(vocalRange[body][0])
      expect(degreeToMidi(high, key)).toBeLessThanOrEqual(vocalRange[body][1])
      expect(high - low).toBeGreaterThanOrEqual(9)
    }
  })
})

describe('timedLine', () => {
  it('times each sounding note as a syllable from the line offset, with its stress, the last ending the line', () => {
    const timed = timedLine(verse[0]!, 8, bpm)
    expect(timed.map((s) => s.at)).toEqual([8, 9, 9.5, 10, 11, 12])
    expect(timed.map((s) => s.stress)).toEqual([1, 0, 0, 1, 0, 1])
    expect(timed.map((s) => s.lineEnd)).toEqual([false, false, false, false, false, true])
  })

  it('counts a line kept at another tempo in the Song beats, and gives unknown words no stress', () => {
    const timed = timedLine({ score: { bpm: 160, lyrics: '', notes: [[60, 2], [60, 2]] } }, 0, bpm)
    expect(timed.map((s) => [s.at, s.beats, s.stress])).toEqual([[0, 1, 0], [1, 1, 0]])
  })
})

describe('longestRun', () => {
  it('counts the most of one pitch in a row', () => {
    expect(longestRun([0, 0, 1, 1, 1, 2])).toBe(3)
    expect(longestRun([4])).toBe(1)
    expect(longestRun([])).toBe(0)
  })
})

describe('writeSections', () => {
  it('writes every line over its section guide, within the compass, mostly on the chord where it stands', () => {
    const written = write([section('verse:0', 'half'), section('chorus:0', 'full', 'b')])
    expect(written.size).toBe(8)
    const [low, high] = compass(lead.key, lead.body)
    let standing = 0
    let on = 0
    for (const [key, w] of written) {
      expect(w.section.split(':')[0]).toBe(key.split(':')[0]!)
      expect(w.degrees).toHaveLength(verse[Number(key.split(':')[1])]!.words.length)
      for (const d of w.degrees) expect(d).toBeGreaterThanOrEqual(low), expect(d).toBeLessThanOrEqual(high)
      expect(w.run).toBeLessThanOrEqual(4)
      standing += w.standing
      on += w.onChord
    }
    expect(on / standing).toBeGreaterThan(0.85)
  })

  it('gives two sections with the same lines and ending one guide, and a line sung twice one melody', () => {
    const written = write([section('chorus:0', 'full'), section('verse:0', 'half', 'v'), section('chorus:1', 'full')])
    const chorus = [...written.values()].filter((w) => w.section.startsWith('chorus'))
    expect(chorus).toHaveLength(4)
    expect(new Set(chorus.map((w) => w.guide)).size).toBe(1)
  })

  it('writes the same for the same iteration, and anew for the next, pulled by the one before', () => {
    const first = write([section('verse:0', 'half')])
    expect(write([section('verse:0', 'half')])).toEqual(first)
    const before = new Map([...first.values()].map((w, i) => [`verse:0:${i}`, w]))
    const next = write([section('verse:0', 'half')], 4n, before as never)
    expect([...next.values()].map((w) => w.degrees)).not.toEqual([...first.values()].map((w) => w.degrees))
  })
})

describe('sungAs', () => {
  it('gives the sounding notes the written pitches in the lead key, keeping rests and lengths', () => {
    const score: Score = { bpm, lyrics: '', notes: [[60, 1], [0, 0.5], [60, 2]] }
    const key = { tonic: 57, mode: modes.dorian }
    expect(sungAs(score, [0, 2], key).notes).toEqual([[57, 1], [0, 0.5], [60, 2]])
  })

  it('leaves a score whose notes the pitches do not match as it is', () => {
    const score: Score = { bpm, lyrics: '', notes: [[60, 1]] }
    expect(sungAs(score, [0, 2], lead.key)).toBe(score)
  })
})
