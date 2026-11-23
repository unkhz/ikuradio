import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileOf, formatTideActions, formatTideRecord, refuseTide, type TideFile } from './record.js'
import { readTides } from './tides.js'

const records = await readTides()
const files = records.map((record) => ({ record, md: readFileSync(join(record.dir, 'tide.md'), 'utf8'), actions: readFileSync(join(record.dir, 'actions.ts'), 'utf8') }))

describe("every Tide's files", () => {
  it('are accepted, and are formatted as the files they are', () => {
    expect(files).toHaveLength(4)
    for (const { record, md, actions } of files) {
      const file = fileOf(md, record)
      expect(refuseTide(file, records)).toBeUndefined()
      expect(formatTideRecord(file)).toBe(md)
      expect(formatTideActions(file)).toBe(actions)
    }
  })

  it('change in the one line a change is: the peak of one envelope', () => {
    const { record, actions, md } = files.find(({ record }) => record.slug === 'verse-wordiness')!
    const file = { ...fileOf(md, record), max: 0.8 }
    const now = formatTideActions(file).split('\n')
    const was = actions.split('\n')
    expect(now.flatMap((line, i) => (line === was[i] ? [] : [line]))).toEqual(['  max: 0.8,'])
    expect(formatTideRecord(file)).toBe(md)
  })
})

describe('what is refused of a Tide', () => {
  const base = (): TideFile => {
    const { record, md } = files.find(({ record }) => record.slug === 'chorus-ceiling')!
    return fileOf(md, record)
  }
  it('says the field, and what is wrong with it', () => {
    expect(refuseTide({ ...base(), attack: 0.6, hold: 0.3, decay: 0.3 }, records)).toContain('attack: attack, hold and decay are shares of a cycle')
    expect(refuseTide({ ...base(), age: [6, 4] }, records)).toContain('age:')
    expect(refuseTide({ ...base(), age: [0, 4] }, records)).toContain('age:')
    expect(refuseTide({ ...base(), max: 20 }, records)).toBe('max: the ceiling can be 0 to 14')
    expect(refuseTide({ ...base(), min: -1 }, records)).toBe('min: the ceiling can be 0 to 14')
    expect(refuseTide({ ...base(), noise: 1.5 }, records)).toContain('noise:')
    expect(refuseTide({ ...base(), grain: 0 }, records)).toContain('grain:')
    expect(refuseTide({ ...base(), moves: { facet: 'melody', part: 'verse', setting: 'wordiness' } as never }, records)).toContain('moves:')
    expect(refuseTide({ ...base(), moves: { facet: 'lyrics', part: 'bridge', setting: 'wordiness' } as never }, records)).toContain('moves: the lyrics Facet has the parts verse, chorus')
    expect(refuseTide({ ...base(), state: 'maybe' }, records)).toContain('state:')
  })

  it('is refused for a second active Tide on one setting of one part, and not for a draft', () => {
    const twin = { ...base(), slug: 'chorus-ceiling-again', moves: records.find(({ slug }) => slug === 'chorus-ceiling')!.moves }
    expect(refuseTide(twin, records)).toBe('moves: chorus-ceiling already moves the ceiling of the chorus: one Tide a setting a part')
    expect(refuseTide({ ...twin, state: 'draft' }, records)).toBeUndefined()
  })
})
