import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { arrange, type Lyrics } from 'song'
import { arrangementSchema, ending, isArrangement, placesOf, refuseArrangement, type Arrangement } from './arrangement.js'
import { readArrangements } from './arrangements.js'
import { readParts } from './registry.js'

const records = await readParts()
const byId = new Map(records.map(({ part }) => [part.id, part]))
const first = readArrangements(records).find(({ arrangement }) => arrangement.id === 'the-song')
const theSong = first!.arrangement

const lyrics: Lyrics = {
  firstVerse: 'first verse words',
  chorus: 'chorus words',
  secondVerse: 'second verse words',
  thirdVerse: 'third verse words',
  finalChorus: 'final chorus words',
}
const sung = arrange(lyrics)
/** The test's own map, from an instance's name to the field of Lyrics arrange() puts there. */
const fieldOf: Record<string, keyof Lyrics> = {
  'verse-1': 'firstVerse',
  chorus: 'chorus',
  'verse-2': 'secondVerse',
  'verse-3': 'thirdVerse',
  'final-chorus': 'finalChorus',
}

describe('the first Arrangement is the Song as it always was', () => {
  it('is found by its folder, and is the Song', () => {
    expect(first!.arrangement.id).toBe('the-song')
    expect(first!.state).toBe('active')
    expect(theSong.instances.map(({ name }) => name)).toEqual(['verse-1', 'bridge-1', 'chorus', 'bridge-2', 'verse-2', 'bridge-3', 'chorus', 'bridge-4', 'verse-3', 'final-chorus'])
  })

  it('has the parts arrange() gives, part for part, and the same words in the same places', () => {
    expect(theSong.instances.map(({ part }) => part)).toEqual(sung.map(({ type }) => type))
    for (const [i, { name }] of theSong.instances.entries()) {
      const part = sung[i]!
      if (part.type === 'bridge') expect(part.content).toBe('')
      else expect(part.content).toBe(lyrics[fieldOf[name]!])
    }
  })

  it("is made by no rule: an Arrangement's bridges are the ones it lists", () => {
    const without: Arrangement = { id: 'plain', title: 'Plain', instances: [{ name: 'a', part: 'verse' }, { name: 'b', part: 'chorus' }] }
    expect(refuseArrangement(without, records)).toBeUndefined()
    expect(placesOf(without, 1n).map(({ before, after }) => [before, after])).toEqual([[undefined, 'chorus'], ['verse', undefined]])
  })

  it('ends as perform ends it today: a chorus, or the last, at home; the others open', () => {
    // the rule perform.ts keeps, written out here: part === 'chorus' || last ? 'full' : 'half'
    const today = (part: string, last: boolean) => (part === 'chorus' || last ? 'full' : 'half')
    const places = placesOf(theSong, 2548n)
    for (const [i, { part }] of theSong.instances.entries()) {
      expect(ending(byId.get(part)!, places[i]!)).toBe(today(part, i === places.length - 1))
    }
  })

  it('its bridges run from and to the parts arrange() puts on either side', () => {
    const places = placesOf(theSong, 1n)
    for (const [i, { part }] of theSong.instances.entries()) {
      if (part !== 'bridge') continue
      expect(places[i]!.before).toBe(sung[i - 1]!.type)
      expect(places[i]!.after).toBe(sung[i + 1]!.type)
    }
    expect(places[0]!.before).toBeUndefined()
    expect(places.at(-1)!.after).toBeUndefined()
    expect(places.map(({ last }) => last)).toEqual([...Array(9).fill(false), true])
  })
})

describe('what is refused', () => {
  const good = (): Arrangement => JSON.parse(JSON.stringify(theSong))
  const refused = (change: (a: any) => void) => {
    const declared = good()
    change(declared)
    return refuseArrangement(declared, records)
  }

  it('accepts the Song', () => {
    expect(refuseArrangement(theSong, records)).toBeUndefined()
    expect(isArrangement(theSong, records)).toBe(true)
  })

  it('a part that does not exist', () => {
    expect(refused((a) => (a.instances[0].part = 'refrain'))).toContain('/instances/0/part')
    // and says which parts there are
    expect(refused((a) => (a.instances[0].part = 'refrain'))).toContain('must be one of bridge, chorus, verse')
  })

  it('a parameter outside its range', () => {
    const message = refused((a) => (a.instances[0].parameters = { wordiness: 1.5 }))
    expect(message).toContain('instance 1 ("verse-1", a verse)')
    expect(message).toContain('/wordiness')
  })

  it('a parameter its part does not have', () => {
    expect(refused((a) => (a.instances[1].parameters = { wordiness: 0.5 }))).toContain('instance 2 ("bridge-1", a bridge)')
    expect(refused((a) => (a.instances[1].parameters = { wordiness: 0.5 }))).toContain('wordiness')
  })

  it('one name for two parts', () => {
    const message = refused((a) => (a.instances[1].name = 'verse-1'))
    expect(message).toContain('the name "verse-1" is already a verse; one name, one part')
  })

  it('no instances', () => {
    expect(refused((a) => (a.instances = []))).toContain('/instances')
  })

  it('a name that is not one, and anything else the shape does not say', () => {
    expect(refused((a) => (a.instances[0].name = 'Verse One'))).toContain('/instances/0/name')
    expect(refused((a) => (a.loudness = 1))).toBeDefined()
    expect(refused((a) => delete a.title)).toContain('title')
  })

  it('the whole schema agrees: what the refusal accepts it accepts, and what the shape refuses it refuses', () => {
    const schema = arrangementSchema(records)
    expect(isArrangement(theSong, records)).toBe(true)
    for (const bad of [
      (a: any) => (a.instances[0].part = 'refrain'),
      (a: any) => (a.instances[0].parameters = { wordiness: 1.5 }),
      (a: any) => (a.instances[1].parameters = { wordiness: 0.5 }),
      (a: any) => (a.instances = []),
    ]) {
      const declared = good()
      bad(declared)
      expect(isArrangement(declared, records)).toBe(false)
      expect(refuseArrangement(declared, records)).toBeDefined()
    }
    expect(schema).toBeDefined()
  })
})

describe('the registry', () => {
  it('fails loudly, naming the folder and the refusal, for a declaration that is refused', () => {
    const home = mkdtempSync(join(tmpdir(), 'arrangements-'))
    const dir = join(home, 'broken')
    mkdirSync(dir)
    writeFileSync(join(dir, 'arrangement.md'), '---\nstate: active\nid: 9\nkind: arrangement\nslug: broken\n---\n# Broken\n')
    writeFileSync(join(dir, 'arrangement.json'), JSON.stringify({ id: 'broken', title: 'Broken', instances: [{ name: 'a', part: 'refrain' }] }))
    expect(() => readArrangements(records, home)).toThrow(/broken.*instances\/0\/part/)
  })

  it("an Arrangement's id is its folder's", () => {
    const home = mkdtempSync(join(tmpdir(), 'arrangements-'))
    const dir = join(home, 'one')
    mkdirSync(dir)
    writeFileSync(join(dir, 'arrangement.md'), '---\nstate: active\nid: 9\nkind: arrangement\nslug: one\n---\n# One\n')
    writeFileSync(join(dir, 'arrangement.json'), readFileSync(join(first!.dir, 'arrangement.json'), 'utf8'))
    expect(() => readArrangements(records, home)).toThrow(/id is its folder's/)
  })
})

describe('interchangeable still', () => {
  it('nothing in arrangement.ts names a part', () => {
    const source = readFileSync(new URL('./arrangement.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/'(verse|chorus|bridge)'/)
  })
})
