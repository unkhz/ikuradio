import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chorusHook, evolve, firstTune, fitToCount, growOnReciting, spacing, variations, type Phrase } from 'melody'
import { arrangementsHome, readArrangements, readParts } from 'parts'
import { arrange, chorusOpening, firstLyrics, type Lyrics } from 'song'
import { layoutOf } from './layout.js'
import { ageOf, bedsAnswer, fittedLine, kindOf, lengthOf, lyricsAnswer, piecesOf, sampleVerse, scoreAnswer, sessionFields, songAnswer, tuneAnswer, wordsOf } from './making.js'

const records = await readParts()
const parts = new Map(records.map(({ part }) => [part.id, part]))
const theSong = readArrangements(records).find(({ arrangement }) => arrangement.id === 'the-song')!.arrangement
const fieldNames = Object.keys(firstLyrics) as (keyof Lyrics)[]
/** What arrange() sings in each place, when every field is given its own name for a text. */
const sung = arrange(Object.fromEntries(fieldNames.map((field) => [field, field])) as Lyrics)

describe('the Tune', () => {
  it("draws the tune's own phrases, the refrain's reciting note ringed, and the refrain staying", () => {
    const answer = tuneAnswer()
    expect(answer.refrain.map(({ notes, rest }) => ({ notes, rest }))).toEqual(firstTune.chorus.map(({ notes, rest }) => ({ notes: notes.map(([d, b]) => [d, b]), rest })))
    expect(answer.refrain.map((phrase) => phrase.reciting)).toEqual(firstTune.chorus.map((_, i) => chorusHook[i]?.reciting))
    expect(answer.refrain.some((phrase) => phrase.reciting !== undefined)).toBe(true)
    expect(answer.refrainStays).toBe(true)
  })

  it('evolves the other phrases as evolve does, marking exactly the notes that moved', () => {
    const answer = tuneAnswer()
    expect(answer.evolution[0]!.phrases.map(({ notes }) => notes)).toEqual(firstTune.verse.map(({ notes }) => notes.map(([d, b]) => [d, b])))
    let tune = firstTune
    for (const { step, phrases } of answer.evolution.slice(1)) {
      const next = evolve(tune, `composer:${step}`)
      expect(phrases.map(({ notes }) => notes)).toEqual(next.verse.map(({ notes }) => notes.map(([d, b]) => [d, b])))
      phrases.forEach((phrase, i) => {
        phrase.notes.forEach(([degree, beats], n) => {
          const before = tune.verse[i]!.notes[n]!
          expect(phrase.changed[n]).toBe(before[0] !== degree || before[1] !== beats)
        })
      })
      tune = next
    }
    // the verse does move: some note, in some step, changed
    expect(answer.evolution.some(({ phrases }) => phrases.some(({ changed }) => changed.some(Boolean)))).toBe(true)
  })

  it("shows a Song's Variations as variations makes them: the first is the tune itself", () => {
    const answer = tuneAnswer()
    const made = variations(firstTune, 4, 'composer', { ornaments: 1, steps: 1 })
    expect(answer.variations).toHaveLength(4)
    answer.variations.forEach(({ phrases }, v) => expect(phrases.map(({ notes }) => notes)).toEqual(made[v]!.verse.map(({ notes }) => notes.map(([d, b]) => [d, b]))))
    expect(answer.variations[0]!.phrases.every(({ changed }) => changed.every((moved) => !moved))).toBe(true)
    expect(answer.variations.slice(1).some(({ phrases }) => phrases.some(({ changed }) => changed.some(Boolean)))).toBe(true)
  })
})

describe('the Lyrics', () => {
  const answer = lyricsAnswer(records, arrangementsHome, 72)

  it('has the five fields, and the instances of the Arrangement that sing each, as arrange() places them', () => {
    expect(answer.fields).toEqual(fieldNames)
    expect(answer.fills.map(({ instance }) => instance)).toEqual(theSong.instances.map(({ name }) => name))
    theSong.instances.forEach(({ name }, i) => {
      const fill = answer.fills[i]!
      expect(fill.instance).toBe(name)
      expect(fill.field as string | undefined).toBe(sung[i]!.content || undefined)
    })
    // a field sung twice is sung by two instances: the refrain's, and nothing else is
    const twice = answer.fields.filter((field) => answer.fills.filter((fill) => fill.field === field).length > 1)
    expect(twice).toHaveLength(1)
  })

  it("gives each written part's lines their count at three wordinesses, as the part measures them", () => {
    for (const { part, lines } of answer.lines) {
      for (const { line, counts } of lines) {
        for (const count of counts) {
          const measured = parts.get(part)!.measure({ line, tune: firstTune, tempo: 72, rate: 6, parameters: { wordiness: count.wordiness } })
          expect(count).toMatchObject(measured)
          expect(count.most).toBeGreaterThanOrEqual(count.target)
        }
        // wordier is never fewer
        expect(counts[0]!.target).toBeLessThanOrEqual(counts[1]!.target)
        expect(counts[1]!.target).toBeLessThanOrEqual(counts[2]!.target)
      }
    }
    expect(answer.lines.map(({ part }) => part).sort()).toEqual([...parts.values()].filter((p) => p.words === 'written').map((p) => p.id).sort())
  })

  it("grows the Song's age as its words outgrow its phrase: not at iteration 1, by a bar or more at 2548", () => {
    expect(answer.age.map(({ iteration }) => iteration)).toEqual([1, 12, 2548])
    expect(answer.age.map(({ text }) => text)).toEqual([1n, 12n, 2548n].map(chorusOpening))
    expect(answer.age[0]!.grown).toBe(0)
    expect(answer.age[2]!.grown).toBeGreaterThanOrEqual(1)
    expect(answer.age[2]!.syllables).toBeGreaterThan(answer.age[0]!.syllables)
    expect(ageOf(2548n, 72, 6)).toEqual(answer.age[2]!)
  })
})

describe('the Score', () => {
  const answer = scoreAnswer(72, 6)

  it('keeps to the grid the melody says, and a rough count of syllables a word at a time', () => {
    expect(answer.k).toBe(spacing(72, 6))
    expect(piecesOf('memory')).toHaveLength(3)
    expect(piecesOf('night')).toHaveLength(1)
    expect(piecesOf('crystal')).toHaveLength(2)
    expect(wordsOf('In the crystal memory of a winter\'s night,').flatMap((w) => w.syllables)).toHaveLength(12)
    expect(wordsOf('night,')[0]!.comma).toBe(true)
  })

  it("fits each sample line to its phrase as fitToCount does, a note to each syllable", () => {
    expect(answer.lines).toHaveLength(sampleVerse.length)
    answer.lines.forEach((line, i) => {
      const words = wordsOf(sampleVerse[i]!)
      const fit = fitToCount(firstTune.verse[i]!, words.map(({ stresses, comma }) => ({ stresses, ...(comma ? { comma } : {}) })), spacing(72, 6))
      expect(line.fits).toBe(Boolean(fit))
      if (fit && line.fitted) {
        expect(line.fitted.notes).toEqual(fit.phrase.notes.map(([d, b]) => [d, b]))
        expect(line.fitted.notes).toHaveLength(line.syllables)
        // it fills the phrase it is fitted to, and the grown bars are whole
        expect(lengthOf(fit.phrase) - lengthOf(firstTune.verse[i]!)).toBe(4 * line.grown)
      }
    })
    expect(answer.lines.every(({ fits }) => fits)).toBe(true)
  })

  it('says a line that does not fit, and does not draw one', () => {
    const tooLong = fittedLine(firstTune.verse[0]!, 'the words of this line are very many and long and will never be sung in a phrase of so few notes at all', 72, 6)
    expect(tooLong.fits).toBe(false)
    expect(tooLong.fitted).toBeUndefined()
  })

  it("grows the refrain's first line on its reciting note, as growOnReciting does", () => {
    const phrase = { ...firstTune.chorus[0]!, reciting: chorusHook[0]!.reciting }
    for (const item of answer.age) {
      const words = wordsOf(item.text)
      const grown = growOnReciting(phrase as Phrase, words.map(({ stresses, comma }) => ({ stresses, ...(comma ? { comma } : {}) })), answer.k)
      expect(item.fitted?.notes).toEqual(grown?.notes.map(([d, b]) => [d, b]))
      expect(item.grownBars).toBe(grown ? Math.round((lengthOf(grown) - lengthOf(firstTune.chorus[0]!)) / 4) : undefined)
    }
    expect(answer.age.at(-1)!.grownBars).toBeGreaterThanOrEqual(1)
  })

  it('is the same Score at the same tempo and another at another', () => {
    expect(scoreAnswer(72, 6)).toEqual(answer)
    expect(scoreAnswer(120, 6).k).toBe(spacing(120, 6))
  })
})

describe('the Beds', () => {
  const answer = bedsAnswer(records, arrangementsHome, 72)

  it("asks for a bed to each part: the part's name, or, with no words, the parts either side of it", () => {
    // what arrange() puts either side of each place, written out here
    const expected = sung.map((part, i) => (part.content ? part.type : `${part.type}:${sung[i - 1]!.type}>${sung[i + 1]!.type}`))
    expect(answer.kinds.map(({ kind }) => kind)).toEqual(expected)
    expect(answer.kinds.filter(({ kind }) => kind.includes('>'))).toHaveLength(4)
    expect(kindOf(parts.get(theSong.instances[0]!.part)!)).toBe(theSong.instances[0]!.part)
  })

  it("makes a guide from a section's words: chords that begin at the start and reach the end, a bass and an upper voice", () => {
    const { guide } = answer
    expect(guide.syllables).toBeGreaterThan(30)
    expect(guide.chords[0]!.at).toBe(0)
    let at = 0
    for (const chord of guide.chords) {
      expect(chord.at).toBeCloseTo(at, 9)
      at += chord.beats
      expect(chord.root).toBeGreaterThanOrEqual(0)
      expect(chord.root).toBeLessThanOrEqual(6)
    }
    expect(at).toBeCloseTo(guide.beats, 6)
    expect(guide.lower.length).toBeGreaterThan(0)
    expect(guide.upper.length).toBeGreaterThan(0)
    expect(guide.furthest).toBeGreaterThanOrEqual(0)
  })

  it('is the same guide each time', () => {
    expect(bedsAnswer(records, arrangementsHome, 72)).toEqual(answer)
  })
})

describe('the Song', () => {
  const answer = songAnswer(records, arrangementsHome, 72)
  const layout = layoutOf(theSong, parts, firstTune, 72)

  it("lays the Arrangement out as a Session's parts would be: in order, with kinds, words and timing", () => {
    expect(answer.parts.map(({ instance }) => instance)).toEqual(theSong.instances.map(({ name }) => name))
    expect(answer.parts.map(({ words }) => words)).toEqual(sung.map(({ content }) => content || undefined))
    expect(answer.parts.map(({ start }) => start)).toEqual(layout.instances.map(({ startSeconds }) => startSeconds))
    expect(answer.seconds).toBe(layout.seconds)
    expect(answer.parts.map(({ kind }) => kind)).toEqual(bedsAnswer(records, arrangementsHome, 72).kinds.map(({ kind }) => kind))
  })

  it("says only fields a Session has: each is a field of the Archive's own type", () => {
    const source = readFileSync(fileURLToPath(new URL('../../archive/lib/session.ts', import.meta.url)), 'utf8')
    const body = source.slice(source.indexOf('export type Session = {'))
    const end = body.indexOf('\n}\n')
    const declared = new Set([...body.slice(0, end).matchAll(/^ {2}(\w+)\??:/gm)].map((match) => match[1]!))
    expect(declared.size).toBeGreaterThan(10)
    for (const { name } of sessionFields) expect(declared.has(name)).toBe(true)
    expect(answer.session).toEqual(sessionFields as unknown as typeof answer.session)
  })
})
