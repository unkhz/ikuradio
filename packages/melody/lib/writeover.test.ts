import { describe, expect, it } from 'bun:test'
import { fitBars, type Syllables } from './fit.js'
import { composeGuide, timedLine, type TimedSyllable, type TwoVoiceGuide } from './guide.js'
import { chorusHook, verseWalk } from './hooks.js'
import { degreeToMidi, modes, type ModeName } from './scale.js'
import { standing, writeOverGuide } from './writer.js'
import { wrongness } from './wrongness.js'

const lineWords: Syllables[][] = [
  [{ stresses: [0] }, { stresses: [1] }, { stresses: [0] }, { stresses: [1, 0] }, { stresses: [0] }, { stresses: [1] }, { stresses: [1], comma: true }],
  [{ stresses: [1, 0] }, { stresses: [0] }, { stresses: [0] }, { stresses: [1] }, { stresses: [0] }, { stresses: [1, 0, 0] }],
  [{ stresses: [0] }, { stresses: [1] }, { stresses: [0], comma: true }, { stresses: [1, 0] }, { stresses: [0] }, { stresses: [1] }, { stresses: [1] }],
  [{ stresses: [1] }, { stresses: [0] }, { stresses: [1, 0, 1] }, { stresses: [0] }, { stresses: [1, 0] }],
]
const beatsOf = (p: { notes: readonly (readonly [number, number])[]; rest: number }) => p.notes.reduce((s, [, b]) => s + b, 0) + p.rest
function sectionOf(phrases: readonly (typeof verseWalk)[number][]) {
  const lines: TimedSyllable[][] = []
  let at = 0
  for (const [i, phrase] of phrases.entries()) {
    const fitted = fitBars(phrase, lineWords[i % 4]!, 1) ?? phrase
    lines.push(timedLine(lineWords[i % 4]!, fitted.notes, at))
    at += beatsOf(fitted)
  }
  return { lines, beats: at }
}
// the number line: a long run of words, a scale word ending each group
const numberWords: Syllables[] = []
for (let g = 0; g < 4; g++) {
  numberWords.push({ stresses: [1, 0] }, { stresses: [1] }, { stresses: [0, 1] }, { stresses: [1, 0], comma: g < 3 })
}
const numberLine = (() => {
  const syllables = numberWords.flatMap((w) => w.stresses)
  return timedLine(
    numberWords.map((w, i) => ({ ...w, group: i % 4 === 3 })),
    syllables.map(() => [0, 0.5] as [number, number]),
  )
})()

type Written = { lines: TimedSyllable[][]; guide: TwoVoiceGuide; melody: number[][]; mode: readonly number[] }
const midiOf = (mode: readonly number[]) => (d: number) => degreeToMidi(d, { tonic: 57, mode })
function write(lines: TimedSyllable[][], beats: number, modeName: ModeName, bpm: number, seed: string, options: { sprinkle?: number; previous?: number[][] } = {}): Written {
  const mode = modes[modeName]
  const guide = composeGuide({ syllables: lines.flat(), beats, bpm, mode, ending: 'full', random: wrongness(`guide:${seed}`) })
  const midi = midiOf(mode)
  const melody: number[][] = []
  let from: number | undefined
  for (const [i, line] of lines.entries()) {
    const written = writeOverGuide({
      syllables: line,
      guide,
      low: -3,
      high: 9,
      random: wrongness(`melody:${seed}:${i}`),
      semitones: (a, b) => Math.abs(midi(a) - midi(b)),
      from,
      closes: i === lines.length - 1,
      sprinkle: options.sprinkle,
      previous: options.previous?.[i],
    })
    melody.push(written)
    from = written.at(-1)
  }
  return { lines, guide, melody, mode }
}

const verse = sectionOf(verseWalk)
const chorus = sectionOf(chorusHook)
const cases: Written[] = []
for (const modeName of Object.keys(modes) as ModeName[]) {
  for (const [bpm, part] of [[72, verse], [92, chorus]] as const) {
    for (const seed of ['a', 'b', 'c']) cases.push(write(part.lines, part.beats, modeName, bpm, `${modeName}:${bpm}:${seed}`))
  }
  cases.push(write([numberLine], numberLine.at(-1)!.at + 0.5, modeName, 84, `number:${modeName}`))
}
const each = function* () {
  for (const w of cases) {
    for (const [l, line] of w.lines.entries()) {
      for (const [i, s] of line.entries()) {
        const chord = w.guide.chords.findLast((c) => c.at <= s.at + 1e-9)!
        yield { w, l, i, s, d: w.melody[l]![i]!, chord, line }
      }
    }
  }
}
const tone = (d: number, root: number) => [0, 2, 4].includes((((d - root) % 7) + 7) % 7)

describe('the writer over the guide', () => {
  it('stands on the guide’s chord where the words lean', () => {
    let points = 0
    let on = 0
    for (const { s, d, chord } of each()) {
      if (!standing(s)) continue
      points++
      if (tone(d, chord.root)) on++
    }
    expect(on / points).toBeGreaterThan(0.9)
  })

  it('settles on the chord at every comma and line end, and closes on the guide’s cadence note', () => {
    for (const { w, l, i, s, d, chord, line } of each()) {
      if (s.comma || s.lineEnd) expect(tone(d, chord.root)).toBe(true)
      if (l === w.lines.length - 1 && i === line.length - 1) {
        expect((((d - w.guide.upper.at(-1)![0]) % 7) + 7) % 7).toBe(0)
      }
    }
  })

  it('stays in its compass, and sings no more than four syllables in a row on one pitch', () => {
    for (const w of cases) {
      for (const line of w.melody) {
        let run = 1
        for (const [i, d] of line.entries()) {
          expect(d).toBeGreaterThanOrEqual(-3)
          expect(d).toBeLessThanOrEqual(9)
          run = i > 0 && d === line[i - 1] ? run + 1 : 1
          expect(run).toBeLessThanOrEqual(4)
        }
      }
    }
  })

  it('turns back after a leap, almost always', () => {
    let leaps = 0
    let turned = 0
    for (const w of cases) {
      for (const line of w.melody) {
        for (let i = 2; i < line.length; i++) {
          const leap = line[i - 1]! - line[i - 2]!
          if (Math.abs(leap) < 3) continue
          leaps++
          if (Math.sign(line[i]! - line[i - 1]!) !== Math.sign(leap)) turned++
        }
      }
    }
    expect(turned / Math.max(1, leaps)).toBeGreaterThan(0.85)
  })

  it('moves mostly by step, and leaps rarely onto a light syllable', () => {
    let moves = 0
    let steps = 0
    for (const w of cases) {
      for (const line of w.melody) {
        for (let i = 1; i < line.length; i++) {
          moves++
          if (Math.abs(line[i]! - line[i - 1]!) <= 1) steps++
        }
      }
    }
    expect(steps / moves).toBeGreaterThan(0.6)
  })

  it('writes the same line for the same seed, a different one for another, and the cheapest at no sprinkle', () => {
    const a = write(verse.lines, verse.beats, 'dorian', 76, 'same')
    expect(write(verse.lines, verse.beats, 'dorian', 76, 'same').melody).toEqual(a.melody)
    expect(write(verse.lines, verse.beats, 'dorian', 76, 'other').melody).not.toEqual(a.melody)
    const plain = (seed: string) => {
      const guide = a.guide
      const midi = midiOf(a.mode)
      return writeOverGuide({ syllables: verse.lines[0]!, guide, low: -3, high: 9, random: wrongness(seed), semitones: (x, y) => Math.abs(midi(x) - midi(y)), sprinkle: 0 })
    }
    expect(plain('x')).toEqual(plain('y'))
  })

  it('is pulled toward the contour of last iteration’s line', () => {
    const before = write(verse.lines, verse.beats, 'aeolian', 76, 'before').melody
    let pulled = 0
    let free = 0
    const agree = (m: number[][]) => {
      let n = 0
      for (const [l, line] of m.entries()) for (let i = 1; i < line.length; i++) if (Math.sign(line[i]! - line[i - 1]!) === Math.sign(before[l]![i]! - before[l]![i - 1]!)) n++
      return n
    }
    for (let k = 0; k < 20; k++) {
      pulled += agree(write(verse.lines, verse.beats, 'aeolian', 76, `next:${k}`, { previous: before }).melody)
      free += agree(write(verse.lines, verse.beats, 'aeolian', 76, `next:${k}`).melody)
    }
    expect(pulled).toBeGreaterThan(free)
  })
})
