import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beatsPerBar, bridgeBeats, firstTune } from 'melody'
import { readArrangements, readParts, readTracks, resolve } from 'parts'
import { layoutOf } from './layout.js'
import { composer } from './serve.js'
import { timelineOf, type TimelineAnswer } from './timeline.js'

const records = await readParts()
const tracks = await readTracks()
const parts = new Map(records.map(({ part }) => [part.id, part]))
const found = await readArrangements(records, undefined, tracks)
const arrangementOf = (id: string) => found.find(({ arrangement }) => arrangement.id === id)!.arrangement

type Answered = { id: string; layout: { instances: { beats: number }[] }; timeline: Exclude<TimelineAnswer, { refusal: string }> }
const asked = async (tempo: number, answer = composer()) => (await (await answer(new Request(`http://composer.test/arrangements.json?tempo=${tempo}`))).json()) as Answered[]

describe('the timeline /arrangements.json answers', () => {
  it('is what resolve gives, region for region and Block for Block, at the layout\'s lengths and the tempo asked for', async () => {
    for (const tempo of [72, 90]) {
      for (const answered of await asked(tempo)) {
        const arrangement = arrangementOf(answered.id)
        const resolved = resolve(arrangement, { beats: answered.layout.instances.map(({ beats }) => beats), mood: tempo })
        expect(answered.timeline.seconds).toBeCloseTo(resolved.seconds, 9)
        expect(answered.timeline.iterations).toBe(resolved.iterations)
        expect(answered.timeline.regions).toHaveLength(resolved.regions.length)
        for (const [i, region] of resolved.regions.entries()) expect(answered.timeline.regions[i]).toMatchObject({ name: region.name, tempo: region.tempo, iteration: region.iteration, segment: region.segment })
        for (const [i, block] of resolved.blocks.entries()) expect(answered.timeline.blocks[i]).toMatchObject({ key: block.key, track: block.track, fadeOut: block.fadeOut, gain: block.gain })
        expect(answered.timeline.blocks.map(({ startSeconds }) => startSeconds)).toEqual(resolved.blocks.map(({ startSeconds }) => startSeconds))
        expect(answered.timeline.beatsPerBar).toBe(beatsPerBar)
      }
    }
  })

  it('says the Song is one tempo, two iterations and one turn, a second long enough for its twenty regions', async () => {
    const song = (await asked(72)).find(({ id }) => id === 'the-song')!.timeline
    expect(song.segments).toEqual([{ tempo: 72, from: 0, to: song.seconds }])
    expect(song.iterations).toBe(2)
    expect(song.turns).toEqual([{ seconds: song.regions[10]!.startSeconds, iteration: 1 }])
    expect(song.regions).toHaveLength(20)
    expect(song.tracks.map(({ id }) => id)).toEqual(['voice', 'bed', 'guide'])
  })

  it('draws free time as free: a stretch with no tempo and the seconds it was given, between two with tempi', async () => {
    const turns = (await asked(72)).find(({ id }) => id === 'tempo-turns')!.timeline
    expect(turns.segments.map(({ tempo }) => tempo)).toEqual([72, null, 96, 72])
    const free = turns.segments[1]!
    expect(free.to - free.from).toBe(10)
    expect(turns.regions.find(({ name }) => name === 'bridge-2')).toMatchObject({ tempo: null, seconds: 10 })
    // the stretches are end to end, and fill the Song
    turns.segments.forEach((segment, i) => expect(segment.from).toBeCloseTo(i === 0 ? 0 : turns.segments[i - 1]!.to, 9))
    expect(turns.segments.at(-1)!.to).toBeCloseTo(turns.seconds, 9)
    expect(turns.iterations).toBe(1)
    expect(turns.turns).toEqual([])
    // a bed under two regions is one Block, and it is longer than either
    const bed = turns.blocks.find(({ key }) => key === 'bed:verse-1:and:bridge-1')!
    expect(bed.endSeconds).toBeGreaterThan(turns.regions[1]!.startSeconds + turns.regions[1]!.seconds)
  })

  it('has the Blocks of the chorus, placed twice in the-song as two Blocks of one key, and split by tempo in tempo-turns', async () => {
    const all = await asked(72)
    const song = all.find(({ id }) => id === 'the-song')!.timeline
    const chorus = song.blocks.filter(({ key }) => key === 'voice:chorus')
    expect(chorus).toHaveLength(2)
    expect(chorus[0]!.startSeconds).not.toBe(chorus[1]!.startSeconds)
    const turns = all.find(({ id }) => id === 'tempo-turns')!.timeline
    expect(turns.blocks.filter(({ key }) => key === 'voice:chorus')).toHaveLength(1)
    expect(turns.blocks.filter(({ key }) => key === 'voice:chorus:96')).toHaveLength(1)
  })

  it('says what makes each Track, and which are not heard', async () => {
    const song = (await asked(72)).find(({ id }) => id === 'the-song')!.timeline
    for (const track of song.tracks) {
      const record = tracks.find((one) => one.track.id === track.id)!
      expect(track.heard).toBe(record.track.heard)
      expect(track.makes).toEqual(record.track.makes ?? null)
    }
    expect(song.tracks.filter(({ heard }) => !heard)).toHaveLength(1)
  })

  it('is said, not drawn, when it cannot be resolved', () => {
    const song = arrangementOf('the-song')
    const layout = layoutOf(song, parts, firstTune, 72)
    const broken = { ...song, tempo: [{ bpm: null }] }
    expect(timelineOf(broken, layout, tracks, 72)).toEqual({ refusal: expect.stringContaining('free time, and so needs its seconds') })
  })
})

describe('the bar', () => {
  it('is melody\'s: a bridge is four of them, and the answer carries it', async () => {
    expect(bridgeBeats).toBe(4 * beatsPerBar)
    expect((await asked(72))[0]!.timeline.beatsPerBar).toBe(beatsPerBar)
  })
})

describe('a Track that nothing makes yet', () => {
  it('is in the answer, with nothing that makes it, and is drawn empty by the page', async () => {
    const home = mkdtempSync(join(tmpdir(), 'tracks-'))
    const tracksLib = fileURLToPath(new URL('../../parts/lib/', import.meta.url))
    const typebox = Bun.resolveSync('typebox', tracksLib)
    for (const id of ['voice', 'bed', 'guide', 'drone', 'drums']) {
      const dir = join(home, id)
      mkdirSync(dir)
      writeFileSync(join(dir, 'track.md'), `---\nstate: active\nid: 1\nkind: track\nslug: ${id}\n---\n# ${id}\n\nA lane.\n`)
      writeFileSync(join(dir, 'track.ts'), `import { Type } from '${typebox}'\nimport { Track } from '${tracksLib}track.ts'\nclass One extends Track {\n  readonly id = '${id}'\n  readonly heard = true\n  readonly parameters = Type.Object({ gain: Type.Optional(Type.Number({ minimum: 0, maximum: 2 })), fadeIn: Type.Optional(Type.Number({ minimum: 0, maximum: 30 })), fadeOut: Type.Optional(Type.Number({ minimum: 0, maximum: 30 })), singers: Type.Optional(Type.String()), breath: Type.Optional(Type.String()), humanness: Type.Optional(Type.Number()), warmth: Type.Optional(Type.Number()), build: Type.Optional(Type.Number()), movement: Type.Optional(Type.Number()), octave: Type.Optional(Type.Integer()), style: Type.Optional(Type.String()), intensity: Type.Optional(Type.Number()), swing: Type.Optional(Type.Number()), halfTime: Type.Optional(Type.Integer()) })\n}\nexport default new One()\n`)
    }
    const song = (await asked(72, composer({ tracksDir: home }))).find(({ id }) => id === 'the-song')!.timeline
    expect(song.tracks.map(({ id }) => id)).toEqual(['voice', 'bed', 'guide'])
    expect(song.tracks.every(({ makes }) => makes === null)).toBe(true)
    // and the Blocks are still there to be drawn
    expect(song.blocks.length).toBeGreaterThan(0)
  })
})
