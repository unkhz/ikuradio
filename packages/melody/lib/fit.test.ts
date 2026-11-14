import { describe, it, expect } from 'bun:test'
import { fitBars, fitPhrase, shortestBeats, spacing, strength, type Phrase, type Syllables } from './fit.js'
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

describe('the grid', () => {
  it('keeps syllables a sixteenth apart at slow tempos and an eighth apart at fast ones, at six a second', () => {
    for (const bpm of [60, 76, 90]) expect(spacing(bpm, 6)).toBe(1)
    for (const bpm of [92, 116, 180]) expect(spacing(bpm, 6)).toBe(2)
    expect(spacing(76, 4)).toBe(2)
  })

  it('never lets a fitted note be quicker than the grid allows, however many syllables come', () => {
    for (const bpm of [60, 76, 92, 116]) {
      const least = shortestBeats(bpm, 6)
      for (const syllables of [9, 15, 22, 30, 42]) {
        const fitted = fitPhrase(chorusHook[0]!, syllables, least)
        expect(fitted.notes).toHaveLength(syllables)
        for (const [, beats] of fitted.notes.slice(0, -1)) expect((beats * 60) / bpm).toBeGreaterThanOrEqual(1 / 6 - 1e-9)
      }
    }
  })
})

describe('fitBars', () => {
  // "This is the song, iteration one," with its stress: the small words never lean
  const opening: Syllables[] = [
    { stresses: [0] },
    { stresses: [0] },
    { stresses: [0] },
    { stresses: [1], comma: true },
    { stresses: [2, 0, 1, 0] },
    { stresses: [1], comma: true },
  ]
  const onsets = (phrase: Phrase) => {
    let at = 0
    return phrase.notes.map(([, beats]) => {
      const start = at * 4
      at += beats
      return start
    })
  }

  it('keeps the tune as written when the words fit its notes and no word straddles a bar line', () => {
    const plain: Syllables[] = [1, 0, 1, 0, 1, 0, 1, 0, 1].map((stress) => ({ stresses: [stress] }))
    expect(fitBars(verseWalk[0]!, plain, 1)).toEqual(verseWalk[0])
  })

  it('keeps a word inside one bar where it can, even the hook’s own "iteration"', () => {
    const fitted = fitBars(chorusHook[0]!, opening, 1)!
    const at = onsets(fitted)
    // it-er-a-tion are syllables 4 to 7: all of them in the first bar
    for (const i of [4, 5, 6, 7]) expect(at[i]!).toBeLessThan(16)
    expect(fitted.notes).toHaveLength(9)
  })

  it('never starts a syllable sooner than k sixteenths after the one before, and ends on the cadence', () => {
    const number: Syllables[] = [...opening.slice(0, 5), { stresses: [1] }, { stresses: [1, 0] }, { stresses: [0] }, { stresses: [1, 0] }, { stresses: [1], comma: true }]
    for (const k of [1, 2]) {
      const fitted = fitBars(chorusHook[0]!, number, k)
      if (!fitted) continue
      expect(fitted.notes).toHaveLength(15)
      const at = onsets(fitted)
      for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(k)
      expect(fitted.notes.at(-1)).toEqual(chorusHook[0]!.notes.at(-1))
      expect(fitted.rest).toBe(chorusHook[0]!.rest)
    }
    // fifteen syllables an eighth apart do not fit in the phrase's two bars
    expect(fitBars(chorusHook[0]!, number, 2)).toBeUndefined()
  })

  it('puts the stressed syllables on stronger beats than the unstressed ones', () => {
    const words: Syllables[] = [{ stresses: [0] }, { stresses: [1] }, { stresses: [0] }, { stresses: [1] }, { stresses: [0] }, { stresses: [1] }, { stresses: [0] }, { stresses: [1] }, { stresses: [0] }, { stresses: [1] }, { stresses: [0] }, { stresses: [1] }]
    const fitted = fitBars(verseWalk[0]!, words, 1)!
    const at = onsets(fitted)
    const stressed = at.filter((_, i) => i % 2 === 1 && i < at.length - 1).map(strength)
    const unstressed = at.filter((_, i) => i % 2 === 0 && i > 0).map(strength)
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean(stressed)).toBeGreaterThan(mean(unstressed))
  })

  it('lets a bar line fall between words rather than inside one', () => {
    // a long word that could straddle the bar line, and room to keep it whole
    const words: Syllables[] = [{ stresses: [1] }, { stresses: [0] }, { stresses: [1, 0, 0] }, { stresses: [0] }, { stresses: [1, 0, 1, 0] }, { stresses: [1] }]
    const fitted = fitBars(verseWalk[1]!, words, 1)!
    const at = onsets(fitted)
    const wordOf = words.flatMap((word, w) => word.stresses.map(() => w))
    for (let i = 1; i < at.length; i++) {
      const crosses = Math.floor(at[i - 1]! / 16) !== Math.floor(at[i]! / 16) || at[i]! % 16 === 0
      if (crosses) expect(wordOf[i]).not.toBe(wordOf[i - 1])
    }
  })

  it('is the same for the same words', () => {
    expect(fitBars(verseWalk[2]!, opening, 1)).toEqual(fitBars(verseWalk[2]!, opening, 1))
  })
})
