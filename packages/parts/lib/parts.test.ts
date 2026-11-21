import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { firstTune } from 'melody'
import { defaults, usualLyrics, usualMelody } from 'perspectives'
import { validRange } from 'tides'
import { fittingFor } from '../../studio/lib/compose.js'
import { Part } from './part.js'
import { partsById, partsHome, readParts } from './registry.js'
import { idSchema, refusal, schemas } from './schema.js'

const records = await readParts()
const byId = await partsById()
const rate = 6

describe('equivalence with what the Studio counts a line by today', () => {
  for (const tempo of [60, 72, 94, 120]) {
    for (const wordiness of [0.2, 0.5, 0.9]) {
      it(`${tempo} bpm, wordiness ${wordiness}`, () => {
        const lyrics = { verse: { wordiness }, chorus: { wordiness } }
        const fitting = fittingFor(firstTune, tempo, rate, lyrics)
        const parameters = { wordiness }
        for (const line of [0, 1, 2, 3]) {
          const verse = byId.get('verse')!.measure({ line, tune: firstTune, tempo, rate, parameters })
          expect({ target: verse.target, most: verse.most }).toEqual(fitting.verse[line]!)
          expect(verse.grows).toBe(false)
          const chorus = byId.get('chorus')!.measure({ line, tune: firstTune, tempo, rate, parameters })
          expect({ target: chorus.target, most: chorus.most }).toEqual(fitting.chorus[line]!)
          // the Song's age is the one line that may grow past its bars
          expect(chorus.grows).toBe(line === 0)
        }
      })
    }
  }

  it('at the usual Settings', () => {
    const settings = defaults(1)
    const fitting = fittingFor(firstTune, 72, rate, settings.lyrics)
    const parameters = { wordiness: settings.lyrics.chorus.wordiness }
    expect(byId.get('chorus')!.measure({ line: 0, tune: firstTune, tempo: 72, rate, parameters })).toMatchObject(fitting.chorus[0]!)
  })
})

describe('parameters not set take the schema\'s defaults', () => {
  it('a line counted with no parameters is counted as the usual wordiness counts it', () => {
    for (const id of ['verse', 'chorus']) {
      for (const line of [0, 1, 2, 3]) {
        const asked = (parameters: Record<string, number>) => byId.get(id)!.measure({ line, tune: firstTune, tempo: 72, rate, parameters })
        expect(asked({})).toEqual(asked({ wordiness: usualLyrics.wordiness }))
      }
    }
  })
})

describe("the Archive's ids", () => {
  it('verse, chorus and bridge can never go: they exist, whatever their state', () => {
    // a retired part is still read, and still in the Archive: it has not gone
    const found = new Set(records.map(({ part }) => part.id))
    for (const id of ['verse', 'chorus', 'bridge']) expect(found.has(id)).toBe(true)
  })

  it('a part is found by its folder, and says its folder as its id', () => {
    for (const { part, dir } of records) expect(dir.endsWith(`/${part.id}`)).toBe(true)
  })
})

describe('interchangeable', () => {
  it('every part keeps all the superclass promises, without the test knowing which it has', () => {
    expect(records.length).toBeGreaterThanOrEqual(3)
    for (const { part } of records) {
      expect(part).toBeInstanceOf(Part)
      expect(['written', 'none']).toContain(part.words)
      expect(['full', 'half']).toContain(part.ending)
      expect((part.parameters as { type?: string }).type).toBe('object')
      const place = { iteration: 2548n, last: false }
      const phrases = part.phrases(firstTune, place)
      expect(Array.isArray(phrases)).toBe(true)
      for (const line of [0, 1, 2, 3]) {
        const measure = part.measure({ line, tune: firstTune, tempo: 72, rate, parameters: {} })
        expect(Number.isFinite(measure.target) && Number.isFinite(measure.most)).toBe(true)
        expect(measure.most).toBeGreaterThanOrEqual(measure.target)
        expect(typeof measure.grows).toBe('boolean')
        const fixed = part.fixedLine?.(line, place)
        expect(fixed === undefined || typeof fixed === 'string').toBe(true)
      }
      // a part with no words has no phrases to write to
      if (part.words === 'none') expect(phrases).toEqual([])
    }
  })

  it("the chorus's first line is the Song's age", () => {
    expect(byId.get('chorus')!.fixedLine?.(0, { iteration: 3n, last: false })).toBe('This is the song, iteration three,')
    expect(byId.get('chorus')!.fixedLine?.(1, { iteration: 3n, last: false })).toBeUndefined()
  })
})

describe('no closed union', () => {
  it("has no 'verse' | 'chorus' | 'bridge' type anywhere in this package", () => {
    const sources: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules') continue
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) sources.push(path)
      }
    }
    walk(partsHome)
    expect(sources.length).toBeGreaterThan(5)
    for (const path of sources) expect(readFileSync(path, 'utf8')).not.toMatch(/'verse'\s*\|\s*'chorus'|'chorus'\s*\|\s*'verse'|'bridge'\s*\|/)
  })
})

describe('the schemas', () => {
  it('the ids are those found, and no other', async () => {
    const id = idSchema(records)
    expect(refusal(id, 'verse')).toBeUndefined()
    expect(refusal(id, 'refrain')).toBeDefined()
  })

  it('a part takes only its own parameters, within their ranges', async () => {
    const { parameters } = await schemas()
    expect(refusal(parameters.verse!, { wordiness: 0.3, ceiling: 4 })).toBeUndefined()
    expect(refusal(parameters.verse!, { wordiness: 1.5 })).toBeDefined()
    expect(refusal(parameters.verse!, { loudness: 1 })).toBeDefined()
    // a bridge has no words, so no wordiness
    expect(refusal(parameters.bridge!, { wordiness: 0.5 })).toBeDefined()
    expect(refusal(parameters.bridge!, { span: 3 })).toBeUndefined()
  })

  it('the ranges are the ones the Tides move within, and the defaults the usual ones', async () => {
    const { parameters } = await schemas()
    const verse = (parameters.verse as unknown as { properties: Record<string, { minimum: number; maximum: number; default: number }> }).properties
    expect([verse.ceiling!.minimum, verse.ceiling!.maximum]).toEqual([...validRange.ceiling])
    expect([verse.span!.minimum, verse.span!.maximum]).toEqual([...validRange.span])
    expect([verse.travel!.minimum, verse.travel!.maximum]).toEqual([...validRange.travel])
    expect([verse.wordiness!.minimum, verse.wordiness!.maximum]).toEqual([...validRange.wordiness])
    expect(verse.wordiness!.default).toBe(usualLyrics.wordiness)
    expect(verse.ceiling!.default).toBe(usualMelody.ceiling)
    expect(verse.span!.default).toBe(usualMelody.span)
    expect(verse.travel!.default).toBe(usualMelody.travel)
  })
})
