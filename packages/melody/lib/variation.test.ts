import type { Phrase } from './fit.js'
import { evolve, firstTune, step, variations, type Tune } from './variation.js'
import { wrongness } from './wrongness.js'

const beats = (p: Phrase) => p.notes.reduce((s, [, b]) => s + b, 0) + p.rest
const degrees = (p: Phrase) => p.notes.map(([d]) => d)

/** How many notes differ in degree or length between two phrases of the same size. */
const distance = (a: Phrase, b: Phrase) =>
  a.notes.filter(([d, l], i) => d !== b.notes[i][0] || l !== b.notes[i][1])
    .length

describe('step', () => {
  const phrase = firstTune.verse[0]

  it('changes at most two inner notes, and never the first or the last', () => {
    for (let i = 0; i < 200; i++) {
      const next = step(phrase, wrongness(`step ${i}`))
      expect(distance(phrase, next)).toBeLessThanOrEqual(2)
      expect(next.notes[0]).toEqual(phrase.notes[0])
      expect(next.notes.at(-1)).toEqual(phrase.notes.at(-1))
      expect(beats(next)).toBe(beats(phrase))
    }
  })

  it('does not change the phrase it is given', () => {
    const before = JSON.stringify(phrase)
    step(phrase, wrongness('x'))
    expect(JSON.stringify(phrase)).toBe(before)
  })
})

describe('evolve', () => {
  it('leaves the chorus exactly as it was', () => {
    let tune: Tune = firstTune
    for (let song = 0; song < 100; song++) tune = evolve(tune, `${song}`)
    expect(tune.chorus).toEqual(firstTune.chorus)
  })

  it('is the same for the same name', () => {
    expect(evolve(firstTune, 'a')).toEqual(evolve(firstTune, 'a'))
  })

  it('walks the verses away slowly, within the range, on the bar lines', () => {
    let tune: Tune = firstTune
    for (let song = 0; song < 1000; song++) {
      const next = evolve(tune, `${song}`)
      next.verse.forEach((phrase, p) => {
        expect(distance(tune.verse[p], phrase)).toBeLessThanOrEqual(2)
        expect(beats(phrase)).toBe(beats(firstTune.verse[p]))
        degrees(phrase).forEach((d) => {
          expect(d).toBeGreaterThanOrEqual(-3)
          expect(d).toBeLessThanOrEqual(7)
        })
      })
      tune = next
    }
    // after a thousand Songs, the verses are somewhere else
    expect(tune.verse).not.toEqual(firstTune.verse)
  })
})

describe('variations', () => {
  it('begins with the tune itself', () => {
    const [first] = variations(firstTune, 3, 'song 0')
    expect(first).toEqual(firstTune)
  })

  it('makes each variation one ornament away from the tune, not from each other', () => {
    const vs = variations(firstTune, 4, 'song 0')
    expect(vs).toHaveLength(4)
    for (const v of vs.slice(1)) {
      const changed = v.verse.reduce(
        (sum, phrase, p) => sum + distance(firstTune.verse[p], phrase),
        0,
      )
      expect(changed).toBeLessThanOrEqual(2)
      expect(v.chorus).toEqual(firstTune.chorus)
    }
  })

  it('always gives at least one', () => {
    expect(variations(firstTune, 0, 'x')).toHaveLength(1)
  })
})
