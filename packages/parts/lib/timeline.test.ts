import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { arrangementSchema, isArrangement, refuseArrangement, type Arrangement } from './arrangement.js'
import { readParts } from './registry.js'
import { Track } from './track.js'
import { readTracks } from './tracks.js'
import { boundaryOf, regionIndex, resolve, type Block } from './timeline.js'

const records = await readParts()
const tracks = await readTracks()

/** Four regions, the third heard again at the end: lengths in beats, under a Mood of 60 a minute, so a beat is a second. */
const instances = [
  { name: 'verse-1', part: 'verse' },
  { name: 'bridge-1', part: 'bridge' },
  { name: 'chorus', part: 'chorus' },
  { name: 'verse-2', part: 'verse' },
  { name: 'chorus', part: 'chorus' },
]
const beats = [32, 16, 32, 32, 32]
const made = (extra: Record<string, unknown> = {}, regions: unknown[] = instances): Arrangement => ({ id: 'made-up', title: 'Made up', instances: regions, ...extra }) as Arrangement
const block = (change: Partial<Block> = {}): Block => ({ track: 'bed', key: 'a', from: { edge: 'start' }, to: { edge: 'end' }, ...change })
const refused = (extra: Record<string, unknown>, regions?: unknown[]) => refuseArrangement(made(extra, regions), records, tracks)

describe('resolve', () => {
  it('has no timeline in an Arrangement that has none: one tempo, the Mood\'s, and no Block', () => {
    const resolved = resolve(made(), { beats, mood: 60 })
    expect(resolved.regions.map(({ startSeconds }) => startSeconds)).toEqual([0, 32, 48, 80, 112])
    expect(resolved.seconds).toBe(144)
    expect(resolved.blocks).toEqual([])
    expect(resolved.regions.every(({ tempo, segment }) => tempo === 60 && segment === 0)).toBe(true)
  })

  it('places a Block across three regions, by anchors', () => {
    const resolved = resolve(made({ blocks: [block({ track: 'bed', from: { region: 'verse-1', edge: 'start' }, to: { region: 'chorus', hearing: 1, edge: 'end' } })] }), { beats, mood: 60 })
    expect(resolved.blocks[0]).toMatchObject({ startSeconds: 0, endSeconds: 80, seconds: 80, startBeats: 0, beats: 80 })
  })

  it('places a Block ending 3 seconds after its region, fading', () => {
    const resolved = resolve(made({ blocks: [block({ from: { region: 'chorus', edge: 'start' }, to: { region: 'chorus', edge: 'end', plus: 3 }, fadeOut: 3 })] }), { beats, mood: 60 })
    expect(resolved.blocks[0]).toMatchObject({ startSeconds: 48, endSeconds: 83, seconds: 35, fadeIn: 0, fadeOut: 3, gain: 1 })
    // it reaches 3 seconds into the region that follows
    expect(resolved.regions[3]!.startSeconds).toBe(80)
  })

  it("finds a region's second hearing, and the whole Song's start and end", () => {
    const resolved = resolve(made({ blocks: [block({ key: 'tail', from: { region: 'chorus', hearing: 2, edge: 'start' }, to: { edge: 'end' } }), block({ key: 'whole' })] }), { beats, mood: 60 })
    expect(resolved.blocks[0]).toMatchObject({ startSeconds: 112, endSeconds: 144 })
    expect(resolved.blocks[1]).toMatchObject({ startSeconds: 0, endSeconds: 144 })
    expect(regionIndex(instances, 'chorus', 2)).toBe(4)
    expect(regionIndex(instances, 'chorus', 3)).toBeUndefined()
  })

  it('counts the beats again from a tempo change, and the seconds run on', () => {
    const arrangement = made({ tempo: [{ bpm: 60 }, { region: 'chorus', bpm: 120 }], blocks: [block({ key: 'in-new', from: { region: 'chorus', edge: 'start' }, to: { region: 'verse-2', edge: 'end' } }), block({ key: 'across', from: { region: 'bridge-1', edge: 'start' }, to: { region: 'chorus', edge: 'end' } })] })
    const resolved = resolve(arrangement, { beats, mood: 90 })
    // 32 beats at 60 is 32 s, 16 beats at 60 is 16 s; then 32 beats at 120 is 16 s
    expect(resolved.regions.map(({ startSeconds }) => startSeconds)).toEqual([0, 32, 48, 64, 80])
    expect(resolved.regions.map(({ segment }) => segment)).toEqual([0, 0, 1, 1, 1])
    // the beats begin again at the change
    expect(resolved.regions.map(({ startBeats }) => startBeats)).toEqual([0, 32, 0, 32, 64])
    expect(resolved.regions.map(({ tempo }) => tempo)).toEqual([60, 60, 120, 120, 120])
    // a Block under the new tempo has beats of it; one across the change has none to count
    expect(resolved.blocks[0]).toMatchObject({ startBeats: 0, beats: 64, startSeconds: 48, endSeconds: 80 })
    expect(resolved.blocks[1]!.beats).toBeUndefined()
    expect(resolved.blocks[1]!.seconds).toBe(32)
  })

  it('has a region in free time last its own seconds, and no beats', () => {
    const regions = instances.map((instance) => (instance.name === 'bridge-1' ? { ...instance, seconds: 5 } : instance))
    const arrangement = made({ tempo: [{ bpm: 60 }, { region: 'bridge-1', bpm: null }, { region: 'chorus', bpm: 60 }], blocks: [block({ key: 'under-it', from: { region: 'bridge-1', edge: 'start' }, to: { region: 'bridge-1', edge: 'end' } })] }, regions)
    const resolved = resolve(arrangement, { beats, mood: 90 })
    expect(resolved.regions[1]).toMatchObject({ tempo: null, seconds: 5, startSeconds: 32 })
    expect(resolved.regions[1]!.beats).toBeUndefined()
    expect(resolved.regions[1]!.startBeats).toBeUndefined()
    // the next region begins 5 seconds on, and counts its beats from nothing again
    expect(resolved.regions[2]).toMatchObject({ startSeconds: 37, segment: 2, startBeats: 0 })
    expect(resolved.blocks[0]).toMatchObject({ startSeconds: 32, endSeconds: 37, seconds: 5 })
    expect(resolved.blocks[0]!.beats).toBeUndefined()
    expect(resolved.seconds).toBe(32 + 5 + 32 + 32 + 32)
  })

  it("keeps a tail past the Song's end in the last region: its beats are the last tempo's, not the first's", () => {
    const arrangement = made({ tempo: [{ bpm: 60 }, { region: 'chorus', bpm: 120 }], blocks: [block({ key: 'tail', from: { region: 'chorus', hearing: 2, edge: 'start' }, to: { region: 'chorus', hearing: 2, edge: 'end', plus: 3 } })] })
    const resolved = resolve(arrangement, { beats, mood: 90 })
    // the last region is 32 beats at 120, 16 s; the tail is 3 s more, under the same tempo
    expect(resolved.blocks[0]).toMatchObject({ startSeconds: 80, endSeconds: 99, seconds: 19, startBeats: 64, beats: 38 })
    // and a Block that begins in the first region's tempo and ends past the end has none to count
    const across = resolve(made({ tempo: [{ bpm: 60 }, { region: 'chorus', bpm: 120 }], blocks: [block({ key: 'long', to: { edge: 'end', plus: 3 } })] }), { beats, mood: 90 })
    expect(across.blocks[0]!.beats).toBeUndefined()
    expect(across.blocks[0]!.endSeconds).toBe(across.seconds + 3)
  })

  it('says plainly what it cannot resolve', () => {
    expect(() => resolve(made({ blocks: [block({ from: { region: 'nowhere', edge: 'start' } })] }), { beats, mood: 60 })).toThrow('no region "nowhere"')
    expect(() => resolve(made({ blocks: [block({ from: { region: 'chorus', edge: 'end' }, to: { region: 'chorus', edge: 'start' } })] }), { beats, mood: 60 })).toThrow('ends before it begins')
    expect(() => resolve(made({ tempo: [{ bpm: null }] }), { beats, mood: 60 })).toThrow('needs its seconds')
    expect(() => resolve(made(), { beats: [], mood: 60 })).toThrow('length in beats is not known')
  })

  it('reads an anchor as a boundary between regions: the end of one is the start of the next', () => {
    expect(boundaryOf(instances, { region: 'verse-1', edge: 'end' })).toEqual(boundaryOf(instances, { region: 'bridge-1', edge: 'start' }))
    expect(boundaryOf(instances, { edge: 'end' })).toEqual({ boundary: 5, plus: 0 })
  })
})

describe('what is refused', () => {
  it('accepts an Arrangement with a timeline, and the one that never had one', () => {
    const good = made({ tempo: [{ bpm: 'mood' }], tracks: ['voice', 'bed'], blocks: [block({ fadeOut: 3, to: { edge: 'end', plus: 3 } }), block({ track: 'voice', key: 'v', source: ['verse-1'], from: { region: 'verse-1', edge: 'start' }, to: { region: 'verse-1', edge: 'end' } })] })
    expect(refuseArrangement(good, records, tracks)).toBeUndefined()
    expect(refuseArrangement(made(), records, tracks)).toBeUndefined()
    expect(isArrangement(good, records, tracks)).toBe(true)
    expect(arrangementSchema(records, tracks)).toBeDefined()
  })

  it('a Block on a Track that does not exist', () => {
    expect(refused({ blocks: [block({ track: 'drums' })] })).toContain('there is no track "drums": the tracks are bed, guide, voice')
    expect(refused({ tracks: ['drums'] })).toContain('names the track "drums", which does not exist')
  })

  it('an anchor naming a region that does not exist, or a hearing that is not', () => {
    expect(refused({ blocks: [block({ to: { region: 'coda', edge: 'end' } })] })).toContain('its to anchor: the Arrangement has no region "coda"')
    expect(refused({ blocks: [block({ from: { region: 'chorus', hearing: 3, edge: 'start' } })] })).toContain('region "chorus" is heard 2 times, not 3')
    expect(refused({ tempo: [{ region: 'coda', bpm: 60 }] })).toContain('tempo change 1')
    expect(refused({ blocks: [block({ source: ['coda'] })] })).toContain('its source names region "coda"')
  })

  it('a Block that ends before it begins', () => {
    expect(refused({ blocks: [block({ from: { region: 'chorus', edge: 'end' }, to: { region: 'chorus', edge: 'start' } })] })).toContain('ends before it begins')
    expect(refused({ blocks: [block({ from: { region: 'verse-1', edge: 'end', plus: 5 }, to: { region: 'verse-1', edge: 'end', plus: 2 } })] })).toContain('ends before it begins')
    // a Block that begins and ends at one moment is not before itself
    expect(refused({ blocks: [block({ from: { region: 'chorus', edge: 'start' }, to: { region: 'chorus', edge: 'start' } })] })).toBeUndefined()
  })

  it('one key on two Tracks, or with two different sources', () => {
    expect(refused({ blocks: [block({ key: 'k', track: 'bed' }), block({ key: 'k', track: 'voice' })] })).toContain('the key "k" is already on the bed track: one key, one track')
    expect(refused({ blocks: [block({ key: 'k', source: ['chorus'] }), block({ key: 'k', source: ['verse-1'] })] })).toContain('the key "k" already has another source')
    // the same key with the same source is one sound placed again
    expect(refused({ blocks: [block({ key: 'k', source: ['chorus'] }), block({ key: 'k', source: ['chorus'], from: { region: 'chorus', hearing: 2, edge: 'start' } })] })).toBeUndefined()
  })

  it('a region in free time without its seconds, or with written words, or seconds without free time', () => {
    const bridge = instances.map((instance) => (instance.name === 'bridge-1' ? { ...instance, seconds: 5 } : instance))
    const free = [{ bpm: 'mood' }, { region: 'bridge-1', bpm: null }, { region: 'chorus', bpm: 'mood' }]
    expect(refused({ tempo: free })).toContain('region 2 ("bridge-1", a bridge): it is in free time, and so needs its seconds')
    expect(refused({ tempo: free }, bridge)).toBeUndefined()
    // a part with written words cannot be sung where there is no beat
    expect(refused({ tempo: [{ bpm: 'mood' }, { region: 'chorus', bpm: null }] })).toContain('it has written words, and cannot be in free time')
    expect(refused({}, bridge)).toContain('it has seconds but is under a tempo')
  })

  it('a region that continues what is not there, what is not its part, or itself', () => {
    const continuing = (name: string, continues: string) => instances.map((instance) => (instance.name === name ? { ...instance, continues } : instance))
    expect(refused({}, continuing('verse-2', 'coda'))).toContain('region 4 ("verse-2", a verse): it continues "coda", which the Arrangement does not have')
    expect(refused({}, continuing('verse-2', 'chorus'))).toContain('it continues "chorus", which is a chorus: a region follows the words of its own part')
    expect(refused({}, continuing('verse-2', 'verse-2'))).toContain('it continues itself')
    expect(refused({}, continuing('verse-2', 'verse-1'))).toBeUndefined()
  })

  it('a Block on a track the Arrangement does not list, since the list is the lanes it draws', () => {
    expect(refused({ tracks: ['voice'], blocks: [block({ track: 'bed' })] })).toContain('does not list the track "bed": it lists voice')
    expect(refused({ tracks: [], blocks: [block({ track: 'bed' })] })).toContain('it lists none')
    // a lane with no Blocks yet is still a lane
    expect(refused({ tracks: ['voice', 'bed', 'guide'], blocks: [block({ track: 'bed' })] })).toBeUndefined()
  })

  it('a Block that begins before the Song does', () => {
    expect(refused({ blocks: [block({ from: { edge: 'start', plus: -1 } })] })).toContain('it begins before the Song does')
    expect(() => resolve(made({ blocks: [block({ from: { region: 'bridge-1', edge: 'start', plus: -40 } })] }), { beats, mood: 60 })).toThrow('begins before the Song does')
    // a Block may begin before a region, if not before the Song
    expect(refused({ blocks: [block({ from: { region: 'bridge-1', edge: 'start', plus: -2 } })] })).toBeUndefined()
  })

  it('a tempo map that goes backwards, or begins elsewhere than the start', () => {
    expect(refused({ tempo: [{ region: 'chorus', bpm: 60 }, { region: 'verse-1', bpm: 90 }] })).toContain('tempo change 1: the first change is for the start')
    expect(refused({ tempo: [{ bpm: 60 }, { region: 'chorus', bpm: 90 }, { region: 'bridge-1', bpm: 60 }] })).toContain('tempo change 3: it is at or before the change before it')
  })

  it("a parameter outside its Track's range, or one the Track has not", () => {
    expect(refused({ blocks: [block({ track: 'voice', fadeIn: 99 })] })).toContain('/fadeIn')
    expect(refused({ blocks: [block({ track: 'guide', gain: 1 })] })).toContain('must not have additional properties: gain')
    expect(refused({ blocks: [block({ track: 'bed', fadeOut: 30 })] })).toBeUndefined()
  })

  it('the shape: a block needs its anchors, and nothing else is allowed', () => {
    expect(refused({ blocks: [{ track: 'bed', key: 'k', from: { edge: 'start' } }] })).toContain('to')
    expect(refused({ blocks: [{ ...block(), loudness: 1 }] })).toBeDefined()
    expect(refused({ tempo: [{ bpm: 5 }] })).toContain('bpm')
  })
})

describe('a Track nobody has told the package of', () => {
  it('is usable with no code changed: found by its folder, and a Block may be put on it', async () => {
    const home = mkdtempSync(join(tmpdir(), 'tracks-'))
    const dir = join(home, 'drums')
    mkdirSync(dir)
    const typebox = Bun.resolveSync('typebox', fileURLToPath(new URL('./', import.meta.url)))
    const trackModule = fileURLToPath(new URL('./track.ts', import.meta.url))
    writeFileSync(join(dir, 'track.md'), '---\nstate: active\nid: 9\nkind: track\nslug: drums\n---\n# The drums keep time\n\nNothing makes them yet.\n')
    writeFileSync(join(dir, 'track.ts'), `import { Type } from '${typebox}'\nimport { Track } from '${trackModule}'\nclass Drums extends Track {\n  readonly id = 'drums'\n  readonly heard = true\n  readonly parameters = Type.Object({ gain: Type.Number({ minimum: 0, maximum: 1, default: 1 }) })\n}\nexport default new Drums()\n`)
    const found = await readTracks(home)
    expect(found.map(({ track }) => track.id)).toEqual(['drums'])
    expect(found[0]!.track.makes).toBeUndefined()
    expect(found[0]!.title).toBe('The drums keep time')
    const all = [...tracks, ...found]
    expect(refuseArrangement(made({ blocks: [block({ track: 'drums', key: 'beat', gain: 0.5 })] }), records, all)).toBeUndefined()
    expect(refuseArrangement(made({ blocks: [block({ track: 'drums', key: 'beat', gain: 2 })] }), records, all)).toContain('/gain')
    // and without it known, a Block on it is refused
    expect(refuseArrangement(made({ blocks: [block({ track: 'drums', key: 'beat' })] }), records, tracks)).toContain('there is no track "drums"')
  })

  it('must keep its folder, its record and its module in step', async () => {
    const home = mkdtempSync(join(tmpdir(), 'tracks-'))
    const dir = join(home, 'one')
    mkdirSync(dir)
    writeFileSync(join(dir, 'track.md'), '---\nstate: active\nid: 9\nkind: track\nslug: one\n---\n# One\n')
    writeFileSync(join(dir, 'track.ts'), readFileSync(new URL('../tracks/guide/track.ts', import.meta.url), 'utf8').replace(/'\.\.\/\.\.\/lib\//g, `'${fileURLToPath(new URL('./', import.meta.url))}`).replace(/'typebox'/, `'${Bun.resolveSync('typebox', fileURLToPath(new URL('./', import.meta.url)))}'`))
    await expect(readTracks(home)).rejects.toThrow(/a Track's id is its folder's/)
  })
})

describe('the Tracks there are', () => {
  it('has the voice, the bed and the guide, each a Track, interchangeably', () => {
    expect(tracks.map(({ track }) => track.id)).toEqual(['bed', 'guide', 'voice'])
    for (const { track, dir } of tracks) {
      expect(track).toBeInstanceOf(Track)
      expect(dir.endsWith(`/${track.id}`)).toBe(true)
      expect(typeof track.heard).toBe('boolean')
      expect((track.parameters as { type?: string }).type).toBe('object')
    }
  })

  it('says what is heard, and what each makes and from what', () => {
    const by = Object.fromEntries(tracks.map(({ track }) => [track.id, track]))
    expect(by.voice!.heard).toBe(true)
    expect(by.bed!.heard).toBe(true)
    expect(by.guide!.heard).toBe(false)
    expect(by.voice!.makes).toEqual({ by: 'the throat', from: 'a Score' })
    expect(by.bed!.makes).toEqual({ by: 'MusicGen', from: 'a hummed guide' })
  })
})
