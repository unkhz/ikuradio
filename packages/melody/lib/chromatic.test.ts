import { describe, expect, it } from 'bun:test'
import {
  chordLeadMidi,
  chordPitchClasses,
  chordsHeard,
  composeGuide,
  harmonizeChoir,
  inTurnsPitches,
  isChromaticGuide,
  keyFor,
  modes,
  roaming,
  traditional,
  vocalRange,
  writeOverGuideChromatic,
  wrongness,
  type Progression,
  type Score,
  type TimedSyllable,
} from '../index.js'

const mod12 = (n: number) => ((n % 12) + 12) % 12

const sampleSyllables = (bars = 8): TimedSyllable[] => {
  const out: TimedSyllable[] = []
  for (let bar = 0; bar < bars; bar++) {
    const base = bar * 4
    out.push(
      { at: base, beats: 1, stress: 1, begins: true, comma: false, lineEnd: false },
      { at: base + 1, beats: 1, stress: 0, begins: true, comma: false, lineEnd: false },
      { at: base + 2, beats: 1, stress: 1, begins: true, comma: false, lineEnd: false },
      { at: base + 3, beats: 1, stress: 0, begins: true, comma: bar % 2 === 1, lineEnd: bar === bars - 1 },
    )
  }
  return out
}

describe('chromatic approach progressions', () => {
  it('travels through semitones and closes by half step across all four chromatic flavors', () => {
    const syllables = sampleSyllables(8)
    for (const flavor of ['approach', 'descent', 'climb', 'roam'] as const) {
      const prog: Progression = { ...roaming, style: 'chromatic', chromatic: flavor }
      const guide = composeGuide({
        syllables,
        beats: 32,
        bpm: 80,
        mode: modes.aeolian,
        ending: 'full',
        random: wrongness(`chromatic:${flavor}`),
        progression: prog,
      })
      expect(isChromaticGuide(guide)).toBe(true)
      expect(guide.chords.length).toBeGreaterThanOrEqual(4)
      // At least one true semitone root step (+/- 1 semitone) in the progression
      const hasSemitoneStep = guide.chords.slice(1).some((c, i) => {
        const d = mod12((c.semitone ?? 0) - (guide.chords[i]!.semitone ?? 0))
        return d === 1 || d === 11
      })
      expect(hasSemitoneStep).toBe(true)
      // Full close approaches home (0) from a semitone away (bII = 1 or VII = 11)
      const penult = guide.chords.at(-2)!.semitone!
      const last = guide.chords.at(-1)!.semitone!
      expect(last).toBe(0)
      expect([1, 11]).toContain(penult)
    }
  })

  it('is deterministic for the same seed and leaves diatonic roaming completely untouched', () => {
    const syllables = sampleSyllables(6)
    const prog: Progression = { ...roaming, style: 'chromatic', chromatic: 'roam' }
    const a = composeGuide({ syllables, beats: 24, bpm: 80, mode: modes.dorian, ending: 'half', random: wrongness('det:1'), progression: prog })
    const b = composeGuide({ syllables, beats: 24, bpm: 80, mode: modes.dorian, ending: 'half', random: wrongness('det:1'), progression: prog })
    expect(a).toEqual(b)

    const diatonic = composeGuide({ syllables, beats: 24, bpm: 80, mode: modes.aeolian, ending: 'full', random: wrongness('det:2'), progression: roaming })
    expect(isChromaticGuide(diatonic)).toBe(false)
    expect(diatonic.chords.every((c) => c.semitone === undefined && c.leadSemitone === undefined)).toBe(true)
  })
})

describe('tonicization and interval-guided modulation', () => {
  it('tonicizes a secondary center via an explicit leading-tone interval and returns home on a full close', () => {
    const syllables = sampleSyllables(8)
    const prog: Progression = { ...roaming, style: 'tonicize', target: 4 } // chromatic mediant (+4)
    const guide = composeGuide({
      syllables,
      beats: 32,
      bpm: 76,
      mode: modes.aeolian,
      ending: 'full',
      random: wrongness('tonicize:4'),
      progression: prog,
    })
    expect(isChromaticGuide(guide)).toBe(true)
    // Visits the tonicized center (+4) and exposes its leading tone (3) as an interval note
    expect(guide.chords.some((c) => c.center === 4)).toBe(true)
    const pivot = guide.chords.find((c) => c.center === 4 && c.leadSemitone !== undefined)!
    expect(pivot).toBeDefined()
    expect(mod12(pivot.leadSemitone!)).toBe(3) // leading tone right below +4!
    // Full close returns home (semitone 0, center unset/0)
    expect(guide.chords.at(-1)!.semitone).toBe(0)
    expect(guide.chords.at(-1)!.center ?? 0).toBe(0)
  })

  it('modulates a section by shift and pivots the outgoing section with the incoming key-defining interval', () => {
    const syllables = sampleSyllables(6)
    const shift = 2 // whole step up (+2 semitones)
    const outgoing = composeGuide({
      syllables,
      beats: 24,
      bpm: 72,
      mode: modes.aeolian,
      ending: 'half',
      random: wrongness('mod:out'),
      progression: roaming,
      nextShift: shift,
    })
    expect(isChromaticGuide(outgoing)).toBe(true)
    const pivotChord = outgoing.chords.at(-1)!
    expect(pivotChord.center).toBe(shift)
    expect(pivotChord.leadSemitone).toBeDefined()
    // Leading tone of +2 is +1 (semitone below incoming tonic!)
    expect(mod12(pivotChord.leadSemitone!)).toBe(1)

    // inTurnsPitches exposes the exact leading-tone MIDI pitch in the upper guide voice for MusicGen
    const key = keyFor('female', 'aeolian')
    const turns = inTurnsPitches(outgoing, key, 72)
    const expectedLeadMidi = chordLeadMidi(pivotChord, key.tonic)
    expect(turns.upper.some(([midi]) => midi === expectedLeadMidi)).toBe(true)

    // Incoming modulated section lives entirely in center = +2
    const modulated = composeGuide({
      syllables,
      beats: 24,
      bpm: 72,
      mode: modes.aeolian,
      ending: 'full',
      random: wrongness('mod:in'),
      progression: { ...roaming, shift },
    })
    expect(modulated.chords.every((c) => c.center === shift)).toBe(true)
    expect(modulated.chords[0]!.semitone).toBe(shift)
    expect(modulated.chords.at(-1)!.semitone).toBe(shift)
  })
})

describe('chromatic melody writer and choir harmonization', () => {
  it('writes singable chromatic melodies over chromatic/modulated chords and harmonizes on true chord tones', () => {
    const syllables = sampleSyllables(6)
    const prog: Progression = { ...roaming, style: 'chromatic', chromatic: 'approach', shift: 1 }
    const guide = composeGuide({
      syllables,
      beats: 24,
      bpm: 80,
      mode: modes.aeolian,
      ending: 'full',
      random: wrongness('mel:chrom'),
      progression: prog,
    })
    const leadKey = keyFor('female', 'aeolian')
    const [lowMidi, highMidi] = vocalRange.female
    const midi = writeOverGuideChromatic({
      syllables,
      guide,
      mode: modes.aeolian,
      tonic: leadKey.tonic,
      lowMidi,
      highMidi,
      random: wrongness('mel:notes'),
      closes: true,
    })
    expect(midi).toHaveLength(syllables.length)
    expect(midi.every((m) => m >= lowMidi && m <= highMidi)).toBe(true)
    // Majority of standing syllables land directly on the chromatic/modulated chord tones
    let standingTotal = 0
    let standingOn = 0
    for (const [i, s] of syllables.entries()) {
      if (!(s.stress === 1 && s.at % 2 === 0) && s.beats < 1) continue
      standingTotal++
      const chord = guide.chords.findLast((c) => c.at <= s.at + 1e-9) ?? guide.chords[0]!
      const tones = chordPitchClasses(chord, modes.aeolian, leadKey.tonic)
      if (tones.includes(mod12(midi[i]!))) standingOn++
    }
    expect(standingOn / standingTotal).toBeGreaterThanOrEqual(0.75)

    // Harmonizer stays consonant beside the chromatic/modulated lead line
    const leadScore: Score = {
      bpm: 80,
      lyrics: '',
      notes: midi.map((m) => [m, 1] as [number, number]),
    }
    const chords = chordsHeard(guide, modes.aeolian, { offset: 0, bpm: 80, lineBpm: 80 })
    const voices = harmonizeChoir({
      lead: leadScore,
      leadKey,
      frame: leadKey,
      keyOf: (b) => keyFor(b, 'aeolian'),
      voices: [{ body: 'male', harmony: -2 }],
      harmony: traditional,
      random: wrongness('harm:chrom'),
      chords,
    })
    expect(voices).toHaveLength(1)
    const consonant = new Set([0, 3, 4, 7, 8, 9])
    for (let i = 0; i < midi.length; i++) {
      const hMidi = voices[0]!.notes[i]![0]
      expect(hMidi).toBeGreaterThanOrEqual(vocalRange.male[0])
      expect(hMidi).toBeLessThanOrEqual(vocalRange.male[1])
      expect(consonant.has(Math.abs(midi[i]! - hMidi) % 12)).toBe(true)
    }
  })
})
