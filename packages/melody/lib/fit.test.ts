import { fitPhrase, type Phrase } from './fit.js'
import { chorusHook, verseWalk } from './hooks.js'
import { degreeToMidi, aeolian } from './scale.js'
import { setLine } from '../index.js'

const beats = (p: Phrase) => p.notes.reduce((s, [, b]) => s + b, 0) + p.rest

describe('fitPhrase', () => {
  const hook = chorusHook[0]

  it('leaves a phrase alone when the words already fit', () => {
    expect(fitPhrase(hook, hook.notes.length)).toEqual(hook)
  })

  it('folds notes away for shorter lines and keeps the bar length', () => {
    const fitted = fitPhrase(hook, 5)
    expect(fitted.notes).toHaveLength(5)
    expect(beats(fitted)).toBe(beats(hook))
    expect(fitted.notes[0][0]).toBe(hook.notes[0][0])
    expect(fitted.notes.at(-1)).toEqual(hook.notes.at(-1))
  })

  it('splits notes for longer lines and keeps the bar length', () => {
    const fitted = fitPhrase(hook, 12)
    expect(fitted.notes).toHaveLength(12)
    expect(beats(fitted)).toBe(beats(hook))
    expect(fitted.notes.at(-1)).toEqual(hook.notes.at(-1))
  })

  it('slows down rather than gabbles when the number grows too long', () => {
    const fitted = fitPhrase(hook, 40)
    expect(fitted.notes).toHaveLength(40)
    expect(beats(fitted)).toBeGreaterThan(beats(hook))
    expect(Math.min(...fitted.notes.map(([, b]) => b))).toBeGreaterThanOrEqual(
      0.25,
    )
  })

  it('can carry a single word', () => {
    expect(fitPhrase(hook, 1).notes).toHaveLength(1)
  })

  it('is the same every time', () => {
    expect(fitPhrase(hook, 17)).toEqual(fitPhrase(hook, 17))
  })
})

describe('the hooks', () => {
  it.each([
    ['chorus', chorusHook],
    ['verse', verseWalk],
  ] as const)(
    '%s lines fill whole bars, two each, three for the last',
    (_, hook) => {
      expect(hook.map(beats)).toEqual([8, 8, 8, 12])
    },
  )

  it('keep whole bars however the words stretch them', () => {
    for (const syllables of [1, 5, 13, 40]) {
      expect(beats(fitPhrase(chorusHook[0], syllables)) % 4).toBe(0)
    }
  })
})

describe('degreeToMidi', () => {
  const a = { tonic: 57, mode: aeolian }
  it('walks the minor scale across octaves', () => {
    expect([-1, 0, 1, 2, 7].map((d) => degreeToMidi(d, a))).toEqual([
      55, 57, 59, 60, 69,
    ])
  })
})

describe('setLine', () => {
  const line = {
    part: 'chorus' as const,
    line: 0,
    lyrics: 'This is the song, iteration one,',
    syllables: 9,
    singer: 'female' as const,
  }

  it('lets a voice sing a third below the tune, within the mode', () => {
    const tune = setLine(line).notes
    const third = setLine({ ...line, harmony: -2 }).notes
    // the hook starts on E: a diatonic third below in A minor is C
    expect(tune[0][0]).toBe(64)
    expect(third[0][0]).toBe(60)
    expect(third.map(([, beats]) => beats)).toEqual(tune.map(([, b]) => b))
  })

  it('keeps silence silent in every voice', () => {
    expect(setLine({ ...line, harmony: -4 }).notes.at(-1)?.[0]).toBe(0)
  })
})
