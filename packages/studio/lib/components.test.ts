import { describe, expect, it } from 'bun:test'
import { isSynthesized, levelOf } from 'archive'
import { firstMood } from 'mood'
import { firstTune } from 'melody'
import { partsById, readArrangements, readParts, readTracks, type Arrangement } from 'parts'
import { firstLyrics } from 'song'
import { askedOf } from './asking.js'
import { extraPartsFor } from './compose.js'
import { throatForBreath, type SungLine } from './perform.js'
import { renderSynths } from './synth.js'
import { sessionOf } from './timeline.js'
import { madeFromSession } from './fixtures/archive.js'
import { readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Session } from 'archive'

const parts = await partsById()
const tracks = await readTracks()
const archived = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/sessions/1862.json', import.meta.url)), 'utf8')) as Session

describe('Studio support for new parts, voice controls, drone, and pulse', () => {
  it('builds extraPartsFor asks only for non-classic written/spoken parts', () => {
    const arrangement: Arrangement = {
      id: 'mixed',
      title: 'Mixed',
      instances: [
        { name: 'verse-1', part: 'verse' },
        { name: 'pre-1', part: 'pre-chorus' },
        { name: 'chorus', part: 'chorus' },
        { name: 'pause', part: 'silence', parameters: { seconds: 3 } },
        { name: 'spoken-1', part: 'spoken', parameters: { lines: 2 } },
        { name: 'interlude-1', part: 'interlude', parameters: { bars: 4 } },
        { name: 'coda', part: 'refrain', parameters: { lines: 1 } },
      ],
    }
    const asks = extraPartsFor(arrangement, 0, firstTune, 72, 6, parts)
    expect(asks.map(({ name, part, lines, spoken }) => ({ name, part, lines, spoken: Boolean(spoken) }))).toEqual([
      { name: 'pre-1', part: 'pre-chorus', lines: 2, spoken: false },
      { name: 'spoken-1', part: 'spoken', lines: 2, spoken: true },
      { name: 'coda', part: 'refrain', lines: 1, spoken: false },
    ])
  })

  it('adjusts singer throat cleanly for soft and pressed breath presets', () => {
    const base = { pressure: 9, tension: 0.45, breathiness: 0.25 }
    expect(throatForBreath(base, 'plain')).toEqual(base)
    const soft = throatForBreath(base, 'soft')!
    expect(soft.breathiness).toBeGreaterThan(base.breathiness)
    expect(soft.tension).toBeLessThan(base.tension)
    const pressed = throatForBreath(base, 'pressed')!
    expect(pressed.tension).toBeGreaterThan(base.tension)
    expect(pressed.pressure).toBeGreaterThan(base.pressure)
  })

  it('renders drone over guide chords, keeps pulse silent in free time, and writes Session with spoken/silence/drone/pulse', async () => {
    const arrangement: Arrangement = {
      id: 'chamber',
      title: 'Chamber',
      instances: [
        { name: 'verse-1', part: 'verse' },
        { name: 'pause', part: 'silence', parameters: { seconds: 3 } },
        { name: 'whisper', part: 'spoken', parameters: { lines: 1 } },
        { name: 'interlude-1', part: 'interlude', parameters: { bars: 4 } },
      ],
      tempo: [{ bpm: 'mood' }, { region: 'whisper', bpm: null }, { region: 'interlude-1', bpm: 84 }],
      tracks: ['voice', 'drone', 'pulse'],
      blocks: [
        {
          track: 'voice',
          key: 'voice:verse-1',
          source: ['verse-1'],
          from: { region: 'verse-1', edge: 'start' },
          to: { region: 'verse-1', edge: 'end' },
          parameters: { singers: 'solo', breath: 'soft' },
        },
        {
          track: 'voice',
          key: 'voice:whisper',
          source: ['whisper'],
          from: { region: 'whisper', edge: 'start' },
          to: { region: 'whisper', edge: 'end' },
        },
        {
          track: 'drone',
          key: 'drone:all',
          from: { edge: 'start' },
          to: { edge: 'end' },
          gain: 0.4,
          fadeIn: 1,
          fadeOut: 2,
          parameters: { warmth: 0.6, movement: 0.4 },
        },
        {
          track: 'pulse',
          key: 'pulse:free',
          from: { region: 'whisper', edge: 'start' },
          to: { region: 'whisper', edge: 'end' },
          gain: 0.3,
        },
        {
          track: 'pulse',
          key: 'pulse:grid',
          from: { region: 'interlude-1', edge: 'start' },
          to: { region: 'interlude-1', edge: 'end' },
          gain: 0.35,
          fadeIn: 0.5,
          fadeOut: 1,
          parameters: { density: 0.7 },
        },
      ],
    }

    const base = madeFromSession(archived)[0]!
    const verseLines = base.lines.filter((l) => l.part === 'verse').slice(0, 4)
    let cursor = 0
    const placedVerse: SungLine[] = verseLines.map((l) => {
      const p = { ...l, at: cursor, region: 0 }
      cursor += l.seconds
      return p
    })
    const silentLine: SungLine = {
      part: 'silence',
      region: 1,
      words: 'silent',
      index: 0,
      lyrics: '',
      file: '',
      voices: [],
      recordings: [],
      seconds: 3,
      enters: 0,
      voiced: 0,
      at: cursor,
      unheard: true,
    }
    cursor += 3
    const spokenLine: SungLine = {
      part: 'spoken',
      region: 2,
      words: 'spoken',
      index: 0,
      lyrics: 'A quiet breath in the dark.',
      file: 'speech-1.wav',
      voices: [],
      speech: { text: 'A quiet breath in the dark.', body: 'female', rate: 0.92 },
      recordings: ['speech-1.wav'],
      seconds: 2.5,
      enters: 0.05,
      voiced: 2.15,
      at: cursor,
    }
    cursor += 2.5
    const interludeLine: SungLine = {
      part: 'interlude',
      region: 3,
      words: 'none',
      index: 0,
      lyrics: '',
      file: '',
      voices: [],
      recordings: [],
      seconds: 4,
      enters: 0,
      voiced: 0,
      at: cursor,
      unheard: true,
    }

    const lines = [...placedVerse, silentLine, spokenLine, interludeLine]
    const measuredSeconds = [
      placedVerse.reduce((s, l) => s + l.seconds, 0),
      3,
      2.5,
      4,
    ]
    const asking = askedOf(arrangement, tracks, measuredSeconds, firstMood.character.tempo, parts)
    expect(asking.passes[0]!.regions[0]!.voice).toEqual({ singers: 'solo', breath: 'soft' })

    const synths = await renderSynths(asking, 0, firstMood, [], '9999')
    try {
      // drone + gridded pulse rendered; free-time pulse skipped cleanly!
      expect(synths.map((s) => `${s.track}:${s.key}`)).toEqual(['drone:drone:all', 'pulse:pulse:grid'])

      const lyrics = { ...firstLyrics, extra: { whisper: 'A quiet breath in the dark.' } }
      const session = sessionOf({
        arrangement,
        arrangementTitle: 'Chamber',
        parts,
        tracks,
        made: [{ composed: { ...base.composed, lyrics }, lines, beds: [], synths }],
        name: (f) => f,
      })

      expect(session.arrangement).toBe('chamber')
      expect(session.arrangementTitle).toBe('Chamber')
      expect(session.tracks).toEqual(['spoken', 'drone', 'pulse'])
      expect(session.iterations[0]!.parts.map(({ type, words }) => [type, words])).toEqual([
        ['verse', undefined],
        ['silence', 'silent'],
        ['spoken', 'spoken'],
        ['interlude', 'none'],
      ])
      const spokenRec = session.recordings.find((r) => r.kind === 'spoken')!
      const droneRec = session.recordings.find((r) => r.kind === 'drone')!
      const pulseRec = session.recordings.find((r) => r.kind === 'pulse')!
      expect(spokenRec.speech?.text).toBe('A quiet breath in the dark.')
      expect(droneRec.synth?.kind).toBe('drone')
      expect(pulseRec.synth?.kind).toBe('pulse')
      // all synthesized locally — never fetched from Archive
      expect(isSynthesized(spokenRec)).toBe(true)
      expect(isSynthesized(droneRec)).toBe(true)
      expect(isSynthesized(pulseRec)).toBe(true)
      // loudness targeting: spoken at voiceLoudness, drone/pulse under voices scaled by block gain (and 0 at gain 0)
      expect(levelOf({ ...spokenRec, loudness: { lufs: -16, peak: -2 } })).toBe(1)
      expect(levelOf({ ...droneRec, loudness: { lufs: -16, peak: -2 } })).toBeCloseTo(0.2, 1)
      expect(levelOf({ ...droneRec, gain: 0, loudness: { lufs: -16, peak: -2 } })).toBe(0)
    } finally {
      for (const s of synths) rmSync(s.file, { force: true })
    }
  })

  it('asks, renders evolving drone + drums synths, and writes Session cleanly for the-ascent', async () => {
    const all = await readArrangements(await readParts(), undefined, tracks)
    const ascent = all.find(({ arrangement }) => arrangement.id === 'the-ascent')!.arrangement
    const asks = extraPartsFor(ascent, 0, firstTune, 74, 6, parts)
    expect(asks.map(({ name, part, lines, spoken }) => ({ name, part, lines, spoken: Boolean(spoken) }))).toEqual([
      { name: 'whisper-1', part: 'spoken', lines: 2, spoken: true },
      { name: 'pre-chorus-1', part: 'pre-chorus', lines: 2, spoken: false },
      { name: 'pre-chorus-2', part: 'pre-chorus', lines: 2, spoken: false },
      { name: 'finale', part: 'outro', lines: 3, spoken: false },
      { name: 'coda', part: 'refrain', lines: 1, spoken: false },
    ])

    // keep synthetic region lengths short so synth rendering in unit tests stays sub-second
    const measuredSeconds = [4, 2, 4, 4, 3, 4, 3, 3.5, 4, 5, 3, 2]
    const asking = askedOf(ascent, tracks, measuredSeconds, 74, parts)
    expect(asking.passes).toHaveLength(1)
    expect(asking.passes[0]!.drones.map((d) => d.key)).toEqual(['drone:ascent', 'drone:peak', 'drone:aftermath'])
    expect(asking.passes[0]!.drums.map((d) => d.key)).toEqual(['drums:ascent', 'drums:peak', 'drums:aftermath'])
    // drums:ascent & drums:peak at Mood 74 bpm, drums:aftermath at 56 bpm
    expect(asking.passes[0]!.drums[0]!.placings[0]!.bpm).toBe(74)
    expect(asking.passes[0]!.drums[1]!.placings[0]!.bpm).toBe(74)
    expect(asking.passes[0]!.drums[2]!.placings[0]!.bpm).toBe(56)

    const synths = await renderSynths(asking, 0, { ...firstMood, character: { ...firstMood.character, tempo: 74 } }, [], '2100')
    try {
      expect(synths.map((s) => `${s.track}:${s.key}`)).toEqual([
        'drone:drone:ascent',
        'drone:drone:peak',
        'drone:drone:aftermath',
        'drums:drums:ascent',
        'drums:drums:peak',
        'drums:drums:aftermath',
      ])
      const ascentDrone = synths.find((s) => s.key === 'drone:ascent')!.synth
      expect(ascentDrone.kind === 'drone' && ascentDrone.warmth).toBe(0.12)
      expect(ascentDrone.kind === 'drone' && ascentDrone.build).toBe(0.92)
      const ascentDrums = synths.find((s) => s.key === 'drums:ascent')!.synth
      expect(ascentDrums.kind === 'drums' && ascentDrums.style).toBe('tribal')
      expect(ascentDrums.kind === 'drums' && ascentDrums.build).toBe(0.96)
      const aftermathDrums = synths.find((s) => s.key === 'drums:aftermath')!.synth
      expect(aftermathDrums.kind === 'drums' && aftermathDrums.style).toBe('ritual')
      expect(aftermathDrums.kind === 'drums' && aftermathDrums.halfTime).toBe(1)

      // levelOf scales drums under voices by gain (and 0 at gain 0)
      expect(levelOf({ id: 'd', kind: 'drums', at: 0, gain: 0.85, seconds: 10, loudness: { lufs: -16, peak: -2 } })).toBeCloseTo(0.425, 2)
      expect(levelOf({ id: 'd', kind: 'drums', at: 0, gain: 0, seconds: 10, loudness: { lufs: -16, peak: -2 } })).toBe(0)
    } finally {
      for (const s of synths) rmSync(s.file, { force: true })
    }
  })

  it('asks and renders procedural tracks cleanly for the-nocturne, the-clockwork, and the-triptych', async () => {
    const all = await readArrangements(await readParts(), undefined, tracks)
    const byId = new Map(all.map((r) => [r.arrangement.id, r.arrangement]))
    const files: string[] = []
    try {
      for (const [id, expectedTracks] of [
        ['the-nocturne', ['drone', 'drone']],
        ['the-clockwork', ['pulse', 'pulse', 'pulse', 'drums']],
        ['the-triptych', ['drone', 'drone', 'drone', 'drone', 'pulse', 'drums', 'drums']],
      ] as const) {
        const arr = byId.get(id)!
        const measured = arr.instances.map(() => 2)
        const asking = askedOf(arr, tracks, measured, 74, parts)
        expect(asking.passes).toHaveLength(1)
        const rendered = await renderSynths(asking, 0, firstMood, [], `test-${id}`)
        files.push(...rendered.map((r) => r.file))
        expect(rendered.map((r) => r.track)).toEqual([...expectedTracks])
      }
    } finally {
      for (const f of files) rmSync(f, { force: true })
    }
  })
})
