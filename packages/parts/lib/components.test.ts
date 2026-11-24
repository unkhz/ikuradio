import { describe, expect, it } from 'bun:test'
import { firstTune } from 'melody'
import { fieldsOf, partsById, readParts, readTracks, refuseArrangement, resolve, makingsOf, type Arrangement } from '../index.js'

const records = await readParts()
const parts = await partsById()
const tracks = await readTracks()

describe('new song components (5 parts + voice controls + drone & pulse tracks)', () => {
  it('registers all 8 active parts and 5 active tracks interchangeably', () => {
    expect(records.map(({ part }) => part.id).sort()).toEqual([
      'bridge',
      'chorus',
      'interlude',
      'pre-chorus',
      'refrain',
      'silence',
      'spoken',
      'verse',
    ])
    expect(tracks.map(({ track }) => track.id).sort()).toEqual(['bed', 'drone', 'guide', 'pulse', 'voice'])
  })

  it('validates an Arrangement combining all new parts, per-block voice parameters, drone, and pulse', () => {
    const arrangement: Arrangement = {
      id: 'chamber-arc',
      title: 'Chamber Arc',
      instances: [
        { name: 'verse-1', part: 'verse' },
        { name: 'pre-1', part: 'pre-chorus', parameters: { wordiness: 0.6 } },
        { name: 'chorus', part: 'chorus' },
        { name: 'pause-1', part: 'silence', parameters: { seconds: 3 } },
        { name: 'whisper-1', part: 'spoken', parameters: { lines: 2, rate: 0.9 } },
        { name: 'interlude-1', part: 'interlude', parameters: { bars: 6 } },
        { name: 'coda-1', part: 'refrain', parameters: { lines: 2 } },
      ],
      tempo: [{ bpm: 'mood' }, { region: 'whisper-1', bpm: null }, { region: 'interlude-1', bpm: 92 }],
      tracks: ['voice', 'bed', 'guide', 'drone', 'pulse'],
      blocks: [
        {
          track: 'voice',
          key: 'voice:verse-1',
          source: ['verse-1'],
          from: { region: 'verse-1', edge: 'start' },
          to: { region: 'verse-1', edge: 'end' },
          parameters: { singers: 'solo', breath: 'soft', humanness: 0.6 },
        },
        {
          track: 'voice',
          key: 'voice:pre-1',
          source: ['pre-1'],
          from: { region: 'pre-1', edge: 'start' },
          to: { region: 'pre-1', edge: 'end' },
          parameters: { singers: 'duet', breath: 'pressed', humanness: 1.2 },
        },
        {
          track: 'voice',
          key: 'voice:whisper-1',
          source: ['whisper-1'],
          from: { region: 'whisper-1', edge: 'start' },
          to: { region: 'whisper-1', edge: 'end' },
        },
        {
          track: 'drone',
          key: 'drone:whole',
          from: { edge: 'start' },
          to: { edge: 'end' },
          gain: 0.4,
          fadeIn: 2,
          fadeOut: 4,
          parameters: { warmth: 0.7, movement: 0.5, octave: 0 },
        },
        {
          track: 'pulse',
          key: 'pulse:late',
          from: { region: 'interlude-1', edge: 'start' },
          to: { region: 'coda-1', edge: 'end' },
          gain: 0.3,
          fadeIn: 1,
          fadeOut: 2,
          parameters: { density: 0.65, swing: 0.15, tone: 0.5 },
        },
      ],
    }

    expect(refuseArrangement(arrangement, records, tracks)).toBeUndefined()

    // fieldsOf maps the-song names to classic Lyrics fields, new written/spoken names to themselves, and wordless/silent to undefined
    expect(fieldsOf(arrangement.instances, undefined, parts)).toEqual([
      'firstVerse',
      'pre-1',
      'chorus',
      undefined,
      'whisper-1',
      undefined,
      'coda-1',
    ])

    // makingsOf preserves block.parameters onto placings
    const resolved = resolve(arrangement, { seconds: [20, 10, 22, 3, 7, 15, 11], mood: 72 })
    const makings = makingsOf(resolved, tracks)
    const solo = makings.find((m) => m.key === 'voice:verse-1')!
    expect(solo.placings[0]!.parameters).toEqual({ singers: 'solo', breath: 'soft', humanness: 0.6 })
    const drone = makings.find((m) => m.key === 'drone:whole')!
    expect(drone.placings[0]!.parameters).toEqual({ warmth: 0.7, movement: 0.5, octave: 0 })
  })

  it('refuses invalid block parameters on voice, drone, and pulse', () => {
    const badVoice: Arrangement = {
      id: 'bad',
      title: 'Bad',
      instances: [{ name: 'verse-1', part: 'verse' }],
      tracks: ['voice'],
      blocks: [
        {
          track: 'voice',
          key: 'v',
          from: { edge: 'start' },
          to: { edge: 'end' },
          parameters: { singers: 'quartet' },
        },
      ],
    }
    expect(refuseArrangement(badVoice, records, tracks)).toContain('voice')

    const badPulse: Arrangement = {
      id: 'bad',
      title: 'Bad',
      instances: [{ name: 'verse-1', part: 'verse' }],
      tracks: ['pulse'],
      blocks: [
        {
          track: 'pulse',
          key: 'p',
          from: { edge: 'start' },
          to: { edge: 'end' },
          parameters: { density: 2 },
        },
      ],
    }
    expect(refuseArrangement(badPulse, records, tracks)).toContain('pulse')
  })

  it('computes phrases and durations for each new part', () => {
    const place = { iteration: 1n, last: false }
    const pre = parts.get('pre-chorus')!
    expect(pre.phrases(firstTune, place)).toHaveLength(2)
    expect(pre.phrases(firstTune, place)[0]!.notes[0]![0]).toBe(firstTune.verse.at(-2)!.notes[0]![0] + 1)

    const ref = parts.get('refrain')!
    expect(ref.phrases(firstTune, place)).toHaveLength(2)
    expect(ref.ending).toBe('full')

    const interlude = parts.get('interlude')!
    expect(interlude.durationSeconds?.(60, { bars: 4 })).toBe(16)
    expect(interlude.durationSeconds?.(null, { bars: 4 })).toBeUndefined()

    const silence = parts.get('silence')!
    expect(silence.durationSeconds?.(72, { seconds: 5 })).toBe(5)
    expect(silence.durationSeconds?.(null, { seconds: 5 })).toBe(5)
  })
})
