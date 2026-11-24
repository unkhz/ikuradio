import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readArrangements, readParts, readTracks } from 'parts'
import { arrange, firstLyrics } from 'song'
import type { Session } from 'archive'
import { againstSections, askedOf, kindOf, laid, measure, partsOf, sourceOf } from './asking.js'
import { madeFromSession } from './fixtures/archive.js'

const records = await readParts()
const tracks = await readTracks()
const theSong = (await readArrangements(records, undefined, tracks)).find(({ arrangement }) => arrangement.id === 'the-song')!.arrangement
const archived = (song: number) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/sessions/${song}.json`, import.meta.url)), 'utf8')) as Session

describe('what the timeline asks the Studio to make', () => {
  const asking = askedOf(theSong, tracks)

  it('has the regions of each iteration, with the words each sings: the parts arrange() gives, in the same order', () => {
    for (const pass of asking.passes) {
      expect(partsOf(pass.regions, firstLyrics).map(({ type, content, index }) => ({ type, content, index }))).toEqual(
        arrange(firstLyrics).map(({ type, content, index }) => ({ type, content, index })),
      )
      expect(partsOf(pass.regions, firstLyrics).at(-1)!.ending).toBe('full')
    }
  })

  it('asks for one voice, one guide and one bed for each name an iteration has: the chorus, heard twice, is made once', () => {
    expect(asking.passes).toHaveLength(2)
    for (const [pass, asked] of asking.passes.entries()) {
      const suffix = pass > 0 ? ':2' : ''
      expect(asked.regions).toHaveLength(10)
      for (const made of [asked.voices, asked.guides, asked.beds]) {
        expect(made).toHaveLength(9)
        expect(new Set(made.map(({ key }) => key)).size).toBe(9)
      }
      expect(asked.beds.map(({ key }) => key)).toContain(`bed:chorus${suffix}`)
      expect(asked.beds.find(({ key }) => key === `bed:chorus${suffix}`)!.placings).toHaveLength(2)
    }
  })

  it('says which region a key is made from, and what kind of bed lies under it', () => {
    const [first] = asking.passes
    const bed = first!.beds.find(({ key }) => key === 'bed:bridge-1')!
    const region = sourceOf(first!, bed)
    expect([region.name, region.index, region.part]).toEqual(['bridge-1', 1, 'bridge'])
    expect(first!.regions.map((_, index) => kindOf(first!.regions, index))).toEqual(['verse', 'bridge:verse>chorus', 'chorus', 'bridge:chorus>verse', 'verse', 'bridge:verse>chorus', 'chorus', 'bridge:chorus>verse', 'verse', 'verse'])
  })

  it('refuses a key from a region the iteration does not have', () => {
    const [first] = asking.passes
    expect(() => sourceOf(first!, { ...first!.beds[0]!, source: ['nowhere'] })).toThrow('which this iteration does not have')
  })

  for (const song of [1855, 1862, 1864]) {
    it(`lays what is made by key where the sections of Song ${song} lie, as the sections were walked before`, () => {
      const made = madeFromSession(archived(song))
      // the key of each made thing, and the measures of the lines, give the timeline; its placings are where the Archive has the beds and the guides
      const measured = theSong.instances.map(() => 0)
      for (const [pass, one] of made.entries()) {
        const { regions } = asking.passes[pass]!
        for (const [n, seconds] of measure(regions, one.composed.lyrics, one.lines).seconds.entries()) measured[regions[n]!.global] = seconds
      }
      const asked = askedOf(theSong, tracks, measured, made[0]!.composed.mood.character.tempo)
      for (const [pass, one] of made.entries()) {
        // what was made, once for each key: the first of its places
        const guides = one.guides!.filter((guide, i, all) => all.findIndex((other) => other.key === guide.key) === i)
        const beds = new Map(one.beds.filter((bed, i, all) => all.findIndex((other) => other.key === bed.key) === i).map((bed) => [bed.key!, bed.file]))
        const lay = laid(asked, pass, guides, beds)
        expect(lay.guides).toHaveLength(one.guides!.length)
        expect(lay.beds).toHaveLength(one.beds.length)
        // every placing lies where the section lies, to the thousandth a Session keeps
        const sections = one.beds.map(({ at, seconds }) => ({ at, seconds: seconds! }))
        expect(againstSections(lay, sections)).toEqual([])
        for (const [i, bed] of lay.beds.entries()) {
          expect(bed.key).toEqual(one.beds[i]!.key!)
          expect(bed.file).toBe(one.beds[i]!.file)
          expect(Math.abs(bed.at - one.beds[i]!.at)).toBeLessThan(1e-3)
          expect(bed.fade).toBe(3)
        }
        for (const [i, guide] of lay.guides.entries()) {
          expect(guide.key).toEqual(one.guides![i]!.key!)
          expect(guide.file).toBe(one.guides![i]!.file)
        }
      }
    })
  }

  it('says where a placing lies elsewhere than its section', () => {
    const made = madeFromSession(archived(1862))
    const asked = askedOf(theSong, tracks)
    const lay = laid(asked, 0, made[0]!.guides!, new Map(made[0]!.beds.map((bed) => [bed.key!, bed.file])))
    const sections = made[0]!.beds.map(({ at, seconds }) => ({ at: at + 5, seconds: seconds! }))
    expect(againstSections(lay, sections).length).toBeGreaterThan(0)
  })

  it('assigns words by name for a bridgeless or reordered Arrangement, not by position', () => {
    const bridgeless = {
      id: 'bridgeless',
      title: 'Bridgeless',
      instances: [
        { name: 'chorus', part: 'chorus' },
        { name: 'verse-1', part: 'verse' },
        { name: 'verse-2', part: 'verse' },
        { name: 'final-chorus', part: 'verse' },
      ],
      tracks: ['voice', 'bed', 'guide'],
      blocks: [],
    }
    const asked = askedOf(bridgeless, tracks)
    expect(asked.passes[0]!.regions.map(({ name, field }) => [name, field])).toEqual([
      ['chorus', 'chorus'],
      ['verse-1', 'firstVerse'],
      ['verse-2', 'secondVerse'],
      ['final-chorus', 'finalChorus'],
    ])
  })

  it('resolves sourceOf by tempo when a name is heard at two tempi (tempo-turns)', async () => {
    const turns = (await readArrangements(records, undefined, tracks)).find(({ arrangement }) => arrangement.id === 'tempo-turns')!.arrangement
    const asked = askedOf(turns, tracks, undefined, 72)
    const [pass] = asked.passes
    const slow = pass!.beds.find(({ key }) => key === 'bed:chorus')!
    const fast = pass!.beds.find(({ key }) => key === 'bed:chorus:96')!
    expect(sourceOf(pass!, slow)).toMatchObject({ name: 'chorus', index: 2, tempo: 72 })
    expect(sourceOf(pass!, fast)).toMatchObject({ name: 'chorus', index: 4, tempo: 96 })
  })

  it('asks for a voice, guide and bed for every region of the-long-breath, with matching tempi and explicit parameters', async () => {
    const breath = (await readArrangements(records, undefined, tracks)).find(({ arrangement }) => arrangement.id === 'the-long-breath')!.arrangement
    const asked = askedOf(breath, tracks, undefined, 72)
    expect(asked.passes).toHaveLength(1)
    const [pass] = asked.passes
    expect(pass!.regions).toHaveLength(8)
    expect(pass!.voices).toHaveLength(8)
    expect(pass!.guides).toHaveLength(8)
    expect(pass!.beds).toHaveLength(8)
    expect(pass!.regions.map(({ tempo }) => tempo)).toEqual([72, 72, 72, 72, null, 96, 96, 72])
    expect(pass!.regions[0]!.parameters).toEqual({ wordiness: 0.2, ceiling: 5, travel: 2 })
    expect(pass!.regions[3]!.ending).toBe('half')
    expect(pass!.regions[7]!.ending).toBe('full')
    expect(sourceOf(pass!, pass!.beds.find(({ key }) => key === 'bed:chorus:96')!)).toMatchObject({ name: 'chorus', index: 6, tempo: 96 })
    expect(sourceOf(pass!, pass!.guides.find(({ key }) => key === 'guide:chorus:96')!)).toMatchObject({ name: 'chorus', index: 6, tempo: 96 })
  })
})
