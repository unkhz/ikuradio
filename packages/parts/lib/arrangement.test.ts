import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { arrange, type Lyrics } from 'song'
import { arrangementSchema, ending, isArrangement, placesOf, refuseArrangement, type Arrangement } from './arrangement.js'
import { readArrangements } from './arrangements.js'
import { readParts } from './registry.js'
import { readTracks } from './tracks.js'

const records = await readParts()
const tracks = await readTracks()
const byId = new Map(records.map(({ part }) => [part.id, part]))
const first = (await readArrangements(records)).find(({ arrangement }) => arrangement.id === 'the-song')
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
  const pass = ['verse-1', 'bridge-1', 'chorus', 'bridge-2', 'verse-2', 'bridge-3', 'chorus', 'bridge-4', 'verse-3', 'final-chorus']
  /** What arrange() sings in a pass, and a second pass of it: the Song walks the whole order twice. */
  const twice = [...sung, ...sung]

  it('is found by its folder, and is the Song: its ten names twice, the words turning over at the second verse-1', () => {
    expect(first!.arrangement.id).toBe('the-song')
    expect(first!.state).toBe('active')
    expect(theSong.instances.map(({ name }) => name)).toEqual([...pass, ...pass])
    expect(theSong.turns).toEqual([{ region: 'verse-1', hearing: 2, edge: 'start' }])
  })

  it('has the parts arrange() gives, part for part and pass for pass, and the same words in the same places', () => {
    expect(theSong.instances.map(({ part }) => part)).toEqual(twice.map(({ type }) => type))
    for (const [i, { name }] of theSong.instances.entries()) {
      const part = twice[i]!
      const original = name
      if (part.type === 'bridge') expect(part.content).toBe('')
      else expect(part.content).toBe(lyrics[fieldOf[original]!] as string)
    }
  })

  it('follows no other name: it sings each name\'s own words again after the turn, and so continues nothing', () => {
    expect(theSong.instances.every(({ continues }) => continues === undefined)).toBe(true)
  })

  it('is one tempo, the Mood\'s, given as the Mood\'s and not a number', () => {
    expect(theSong.tempo).toEqual([{ bpm: 'mood' }])
  })

  it("is made by no rule: an Arrangement's bridges are the ones it lists", () => {
    const without: Arrangement = { id: 'plain', title: 'Plain', instances: [{ name: 'a', part: 'verse' }, { name: 'b', part: 'chorus' }] }
    expect(refuseArrangement(without, records, tracks)).toBeUndefined()
    expect(placesOf(without, 1n).map(({ before, after }) => [before, after])).toEqual([[undefined, 'chorus'], ['verse', undefined]])
  })

  it("ends as its instance says, else as the part says, and the very last at home: only the final chorus says", () => {
    const places = placesOf(theSong, 2548n)
    for (const [i, { part, ending: said }] of theSong.instances.entries()) {
      expect(ending(byId.get(part)!, places[i]!)).toBe(said ?? (i === places.length - 1 ? 'full' : byId.get(part)!.ending))
    }
  })

  it('lets an instance say its own ending, over the part\'s and over the last\'s', () => {
    const arrangement: Arrangement = { id: 'ends', title: 'Ends', instances: [{ name: 'a', part: 'chorus', ending: 'half' }, { name: 'b', part: 'verse', ending: 'full' }, { name: 'c', part: 'verse', ending: 'half' }] }
    expect(refuseArrangement(arrangement, records, tracks)).toBeUndefined()
    const places = placesOf(arrangement, 1n)
    expect(arrangement.instances.map(({ part }, i) => ending(byId.get(part)!, places[i]!))).toEqual(['half', 'full', 'half'])
    expect(refuseArrangement({ ...arrangement, instances: [{ name: 'a', part: 'verse', ending: 'quarter' }] }, records, tracks)).toBeDefined()
  })

  it('has its bridges run from and to the parts arrange() puts on either side, in each pass', () => {
    const places = placesOf(theSong, 1n)
    for (const [i, { part }] of theSong.instances.entries()) {
      if (part !== 'bridge') continue
      expect(places[i]!.before).toBe(twice[i - 1]!.type)
      expect(places[i]!.after).toBe(twice[i + 1]!.type)
    }
    expect(places[0]!.before).toBeUndefined()
    expect(places.at(-1)!.after).toBeUndefined()
    expect(places.map(({ last }) => last)).toEqual([...Array(19).fill(false), true])
  })
})

describe('what is refused', () => {
  const good = (): Arrangement => JSON.parse(JSON.stringify(theSong))
  const refused = (change: (a: any) => void) => {
    const declared = good()
    change(declared)
    return refuseArrangement(declared, records, tracks)
  }

  it('accepts the Song', () => {
    expect(refuseArrangement(theSong, records, tracks)).toBeUndefined()
    expect(isArrangement(theSong, records, tracks)).toBe(true)
  })

  it('a part that does not exist', () => {
    expect(refused((a) => (a.instances[0].part = 'unknown-part'))).toContain('/instances/0/part')
    // and says which parts there are
    expect(refused((a) => (a.instances[0].part = 'unknown-part'))).toContain('must be one of bridge, chorus, interlude, outro, pre-chorus, refrain, silence, spoken, verse')
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

  it('two instances wrong: the options told are the first one\'s, not both mixed', () => {
    const message = refused((a) => {
      a.instances[0].part = 'unknown-a'
      a.instances[1].part = 'unknown-b'
    })!
    expect(message).toContain('/instances/0/part must be one of bridge, chorus, interlude, outro, pre-chorus, refrain, silence, spoken, verse')
    expect(message.match(/bridge/g)).toHaveLength(1)
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
    const schema = arrangementSchema(records, tracks)
    expect(isArrangement(theSong, records, tracks)).toBe(true)
    for (const bad of [
      (a: any) => (a.instances[0].part = 'unknown-part'),
      (a: any) => (a.instances[0].parameters = { wordiness: 1.5 }),
      (a: any) => (a.instances[1].parameters = { wordiness: 0.5 }),
      (a: any) => (a.instances = []),
    ]) {
      const declared = good()
      bad(declared)
      expect(isArrangement(declared, records, tracks)).toBe(false)
      expect(refuseArrangement(declared, records, tracks)).toBeDefined()
    }
    expect(schema).toBeDefined()
  })
})

describe('the registry', () => {
  it('fails loudly, naming the folder and the refusal, for a declaration that is refused', async () => {
    const home = mkdtempSync(join(tmpdir(), 'arrangements-'))
    const dir = join(home, 'broken')
    mkdirSync(dir)
    writeFileSync(join(dir, 'arrangement.md'), '---\nstate: active\nid: 9\nkind: arrangement\nslug: broken\n---\n# Broken\n')
    writeFileSync(join(dir, 'arrangement.json'), JSON.stringify({ id: 'broken', title: 'Broken', instances: [{ name: 'a', part: 'unknown-part' }] }))
    await expect(readArrangements(records, home)).rejects.toThrow(/broken.*instances\/0\/part/)
  })

  it("an Arrangement's id is its folder's", async () => {
    const home = mkdtempSync(join(tmpdir(), 'arrangements-'))
    const dir = join(home, 'one')
    mkdirSync(dir)
    writeFileSync(join(dir, 'arrangement.md'), '---\nstate: active\nid: 9\nkind: arrangement\nslug: one\n---\n# One\n')
    writeFileSync(join(dir, 'arrangement.json'), readFileSync(join(first!.dir, 'arrangement.json'), 'utf8'))
    await expect(readArrangements(records, home)).rejects.toThrow(/id is its folder's/)
  })
})

describe('interchangeable still', () => {
  it('nothing in arrangement.ts names a part', () => {
    const source = readFileSync(new URL('./arrangement.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/'(verse|chorus|bridge)'/)
  })
})
