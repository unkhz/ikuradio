import { describe, expect, it } from 'bun:test'
import { fitBars, type Syllables } from './fit.js'
import { chordLengths, composeGuide, timedLine, type Ending, type TwoVoiceGuide } from './guide.js'
import { chorusHook, verseWalk } from './hooks.js'
import { degreeToMidi, modes, type ModeName } from './scale.js'
import { wrongness } from './wrongness.js'

// a verse of four lines as the bar fit lays them, words with their stress and commas
const lineWords: Syllables[][] = [
  [{ stresses: [0] }, { stresses: [1] }, { stresses: [0] }, { stresses: [1, 0] }, { stresses: [0] }, { stresses: [1] }, { stresses: [1], comma: true }],
  [{ stresses: [1, 0] }, { stresses: [0] }, { stresses: [0] }, { stresses: [1] }, { stresses: [0] }, { stresses: [1, 0, 0] }],
  [{ stresses: [0] }, { stresses: [1] }, { stresses: [0], comma: true }, { stresses: [1, 0] }, { stresses: [0] }, { stresses: [1] }, { stresses: [1] }],
  [{ stresses: [1] }, { stresses: [0] }, { stresses: [1, 0, 1] }, { stresses: [0] }, { stresses: [1, 0] }],
]
const phraseBeats = (p: { notes: readonly (readonly [number, number])[]; rest: number }) => p.notes.reduce((s, [, b]) => s + b, 0) + p.rest
const section = (phrases: readonly typeof verseWalk[number][]) => {
  const syllables = []
  let at = 0
  for (const [i, phrase] of phrases.entries()) {
    const fitted = fitBars(phrase, lineWords[i % 4]!, 1) ?? phrase
    syllables.push(...timedLine(lineWords[i % 4]!, fitted.notes, at))
    at += phraseBeats(fitted)
  }
  return { syllables, beats: at }
}
const verse = section(verseWalk)
const chorus = section(chorusHook)

const midi = (degree: number, mode: readonly number[]) => degreeToMidi(degree, { tonic: 57, mode })
const cases: { guide: TwoVoiceGuide; ending: Ending; mode: readonly number[]; bpm: number }[] = []
for (const mode of Object.keys(modes) as ModeName[]) {
  for (const bpm of [60, 76, 92, 116]) {
    for (const [name, part, ending] of [['verse', verse, 'half'], ['chorus', chorus, 'full'], ['bridge', { syllables: [], beats: 16 }, 'half']] as const) {
      for (const seed of ['a', 'b', 'c']) {
        const guide = composeGuide({ ...part, bpm, mode: modes[mode], ending, random: wrongness(`guide:${name}:${mode}:${bpm}:${seed}`) })
        cases.push({ guide, ending, mode: modes[mode], bpm })
      }
    }
  }
}

describe('the two-voice guide', () => {
  it('is consonant on every chord change: thirds, sixths, tenths, fifths and octaves', () => {
    for (const { guide, mode } of cases) {
      for (const chord of guide.chords) {
        expect([0, 3, 4, 7, 8, 9]).toContain((midi(chord.upper, mode) - midi(chord.bass, mode)) % 12)
        expect(midi(chord.upper, mode)).toBeGreaterThan(midi(chord.bass, mode))
      }
    }
  })

  it('never moves in parallel fifths or octaves', () => {
    for (const { guide, mode } of cases) {
      for (let i = 1; i < guide.chords.length; i++) {
        const [a, b] = [guide.chords[i - 1]!, guide.chords[i]!]
        if (a.bass === b.bass || a.upper === b.upper) continue
        const was = (midi(a.upper, mode) - midi(a.bass, mode)) % 12
        const is = (midi(b.upper, mode) - midi(b.bass, mode)) % 12
        expect([0, 7].includes(was) && was === is).toBe(false)
      }
    }
  })

  it('ends every section on a cadence: open on the fifth degree, or home through it', () => {
    for (const { guide, ending } of cases) {
      const [penultimate, last] = guide.chords.slice(-2)
      if (guide.chords.length < 2) continue
      if (ending === 'half') {
        expect(last!.root).toBe(4)
        expect(((last!.bass % 7) + 7) % 7).toBe(4)
      } else {
        expect([penultimate!.root, last!.root]).toEqual([4, 0])
        expect(((last!.bass % 7) + 7) % 7).toBe(0)
        expect(((last!.upper % 7) + 7) % 7).toBe(0)
        expect(Math.abs(last!.upper - penultimate!.upper)).toBe(1)
      }
    }
  })

  it('leaves from home, and builds every chord of its own notes', () => {
    for (const { guide, ending } of cases) {
      if (!(ending === 'full' && guide.chords.length === 2)) expect(guide.chords[0]!.root).toBe(0)
      for (const chord of guide.chords) {
        for (const voice of [chord.bass, chord.upper]) expect([0, 2, 4]).toContain((((voice - chord.root) % 7) + 7) % 7)
      }
    }
  })

  it('changes chord no sooner than a beat and 0.6 s, no later than two bars and 6 s, and holds no note under half a second', () => {
    for (const { guide, bpm } of cases) {
      const { least, most } = chordLengths(bpm)
      expect(guide.chords.reduce((sum, c) => sum + c.beats, 0)).toBeCloseTo(guide.beats)
      for (const chord of guide.chords) {
        expect(chord.beats).toBeGreaterThanOrEqual(least - 1e-9)
        expect(chord.beats).toBeLessThanOrEqual(most + 1e-9)
      }
      for (const [, beats] of [...guide.lower, ...guide.upper]) expect((beats * 60) / bpm).toBeGreaterThanOrEqual(0.5 - 1e-9)
    }
  })

  it('finds its furthest point late in the section, more often than not', () => {
    const long = cases.filter(({ guide }) => guide.chords.length >= 5)
    const late = long.filter(({ guide }) => guide.furthest >= guide.chords.length / 2)
    expect(long.length).toBeGreaterThan(10)
    expect(late.length / long.length).toBeGreaterThan(0.6)
  })

  it('changes chord where the words lean: at line starts more than anywhere else', () => {
    const guide = composeGuide({ ...verse, bpm: 76, mode: modes.aeolian, ending: 'half', random: wrongness('lean') })
    const lineStarts = new Set(verse.syllables.filter((_, i, all) => all[i - 1]?.lineEnd).map(({ at }) => at))
    const onLineStarts = guide.chords.filter(({ at }) => lineStarts.has(at)).length
    expect(onLineStarts).toBeGreaterThanOrEqual(2)
  })

  it('is the same for the same section, and drifts, not jumps, toward last iteration’s', () => {
    const make = (seed: string, previous?: TwoVoiceGuide) =>
      composeGuide({ ...verse, bpm: 76, mode: modes.dorian, ending: 'half', random: wrongness(seed), previous })
    expect(make('same')).toEqual(make('same'))
    const before = make('before')
    let shared = 0
    let alone = 0
    for (let n = 0; n < 40; n++) {
      const pulled = make(`next:${n}`, before)
      const free = make(`next:${n}`)
      const same = (g: TwoVoiceGuide) => g.chords.filter((c, i) => before.chords[i]?.root === c.root).length
      shared += same(pulled)
      alone += same(free)
    }
    expect(shared).toBeGreaterThan(alone)
  })
})
