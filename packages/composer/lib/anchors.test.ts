import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readArrangements, readParts, readTracks, resolve } from 'parts'
import { composer } from './serve.js'

// the page's own code, as the page loads it, run here: it is pure, and what a drop is written as is worth proving
const code = readFileSync(fileURLToPath(new URL('../concepts/arrangement/anchors.js', import.meta.url)), 'utf8')
const api = new Function(`${code}\nreturn { anchorAt, anchorFor, boundaryOf, coveredBy, labelOf, nearestBoundary, regionIndexOf, shiftAnchor, barsOf, tempoUnder }`)() as Record<string, (...args: any[]) => any>

type Timeline = { seconds: number; beatsPerBar: number; regions: { index: number; name: string; part: string; tempo: number | null; startSeconds: number; seconds: number }[]; segments: { tempo: number | null; from: number; to: number }[] }
const asked = (await (await composer()(new Request('http://composer.test/arrangements.json?tempo=72'))).json()) as { id: string; timeline: Timeline }[]
const records = await readParts()
const tracks = await readTracks()
const arrangements = await readArrangements(records, undefined, tracks)
const turns = asked.find(({ id }) => id === 'tempo-turns')!.timeline
const song = asked.find(({ id }) => id === 'the-song')!.timeline
const names = (timeline: Timeline) => timeline.regions.map(({ name }) => name)
const startOf = (timeline: Timeline, name: string, hearing = 1) => timeline.regions.filter((region) => region.name === name)[hearing - 1]!.startSeconds

describe('the anchor a drop is written as', () => {
  it('is, snapped, the edge of the region it is near: a start for a `from`, an end for a `to`, with the hearing where a name is heard twice', () => {
    const at = startOf(turns, 'chorus')
    const from = api.anchorAt!(turns, names(turns), at + 0.05, { side: 'from', radius: 0.5 })
    expect(from.anchor).toEqual({ region: 'chorus', hearing: 1, edge: 'start' })
    expect(from.seconds).toBeCloseTo(at, 9)
    expect(from.snapped).toBe('edge')
    expect(from.label).toBe('chorus (1) start')
    const to = api.anchorAt!(turns, names(turns), startOf(turns, 'bridge-1') - 0.1, { side: 'to', radius: 0.5 })
    expect(to.anchor).toEqual({ region: 'verse-1', edge: 'end' })
    // the same moment is an end of the one and the start of the next, and which is said is the side's
    expect(api.anchorAt!(turns, names(turns), startOf(turns, 'bridge-1'), { side: 'from', radius: 0.5 }).anchor).toEqual({ region: 'bridge-1', edge: 'start' })
    // the Song's own ends
    expect(api.anchorAt!(turns, names(turns), 0.1, { side: 'from', radius: 0.5 }).anchor).toEqual({ region: 'verse-1', edge: 'start' })
    expect(api.anchorAt!(turns, names(turns), turns.seconds - 0.1, { side: 'to', radius: 0.5 }).anchor).toEqual({ region: 'verse-2', edge: 'end' })
    expect(api.anchorAt!(turns, names(turns), turns.seconds, { side: 'from', radius: 0.5 }).anchor).toEqual({ edge: 'end' })
  })

  it('snaps to a bar where there is a tempo, as the region it is in, so many seconds beyond its start', () => {
    const bar = (4 * 60) / 72
    const dropped = api.anchorAt!(turns, names(turns), bar + 0.1, { side: 'from', radius: 0.4 })
    expect(dropped.snapped).toBe('bar')
    expect(dropped.anchor.region).toBe('verse-1')
    expect(dropped.anchor.plus).toBeCloseTo(bar, 3)
    expect(dropped.seconds).toBeCloseTo(bar, 2)
    // bars at 96 are shorter: they count from the start of their own stretch
    const quick = startOf(turns, 'chorus', 2)
    const second = api.anchorAt!(turns, names(turns), quick + 2.5 + 0.05, { side: 'from', radius: 0.3 })
    expect(second.snapped).toBe('bar')
    expect(second.anchor).toMatchObject({ region: 'chorus', hearing: 2, edge: 'start' })
    expect(second.anchor.plus).toBeCloseTo(2.5, 3)
  })

  it('is, unsnapped, the nearest edge plus seconds to a tenth, and says so in words', () => {
    const dropped = api.anchorAt!(turns, names(turns), startOf(turns, 'bridge-1') + 2.04, { side: 'to', snap: false })
    expect(dropped.anchor).toEqual({ region: 'verse-1', edge: 'end', plus: 2 })
    expect(dropped.label).toBe('verse-1 end + 2.0 s')
    expect(dropped.snapped).toBeNull()
    const before = api.anchorAt!(turns, names(turns), startOf(turns, 'bridge-1') - 1.26, { side: 'to', snap: false })
    expect(before.anchor).toEqual({ region: 'verse-1', edge: 'end', plus: -1.3 })
    expect(before.label).toBe('verse-1 end − 1.3 s')
    // snapping on but nothing near: the same
    expect(api.anchorAt!(turns, names(turns), startOf(turns, 'bridge-1') + 2.04, { side: 'to', radius: 0.1 }).anchor).toEqual(dropped.anchor)
  })

  it('has no bars in free time: a stretch with no tempo is dropped on by its edges and the seconds from them', () => {
    const free = turns.regions.find(({ tempo }) => tempo === null)!
    expect(api.barsOf!(turns).some(({ seconds }: { seconds: number }) => seconds > free.startSeconds + 1e-6 && seconds < free.startSeconds + free.seconds - 1e-6)).toBe(false)
    const inside = api.anchorAt!(turns, names(turns), free.startSeconds + 4.04, { side: 'from', radius: 0.5 })
    expect(inside.snapped).toBeNull()
    expect(inside.anchor).toEqual({ region: free.name, edge: 'start', plus: 4 })
    const late = api.anchorAt!(turns, names(turns), free.startSeconds + free.seconds - 1.2, { side: 'to', radius: 0.1 })
    expect(late.anchor).toEqual({ region: free.name, edge: 'end', plus: -1.2 })
  })

  it('means what it says: resolved by the package, the anchor is the moment the page said', () => {
    const arrangement = arrangements.find(({ arrangement: one }) => one.id === 'tempo-turns')!.arrangement
    const lengths = asked.find(({ id }) => id === 'tempo-turns')!.timeline.regions.map(({ seconds, tempo }) => (tempo === null ? undefined : (seconds * tempo) / 60))
    for (const snap of [true, false]) {
      for (const t of [0.4, 3.4, 29.7, 30.2, 44.1, 75.3, 80.9, 84.0, 90.2, 120.4, 145.5]) {
        const a = api.anchorAt!(turns, names(turns), t, { side: 'from', snap, radius: 0.4 })
        const b = api.anchorAt!(turns, names(turns), t + 1.5, { side: 'to', snap, radius: 0.4 })
        const made = { ...arrangement, blocks: [{ track: 'bed', key: 'probe', from: a.anchor, to: b.anchor }] }
        const resolved = resolve(made, { beats: lengths, mood: 72 })
        expect(resolved.blocks[0]!.startSeconds).toBeCloseTo(a.seconds, 6)
        expect(resolved.blocks[0]!.endSeconds).toBeCloseTo(b.seconds, 6)
      }
    }
  })

  it('moves an anchor whole regions on, keeping its seconds beyond; a Block moved so keeps its shape', () => {
    const n = names(turns)
    const tail = { region: 'bridge-1', edge: 'end', plus: 3 }
    // to the chorus after it, by two boundaries: the chorus's end, as a `to`
    expect(api.shiftAnchor!(n, tail, 2, 'to')).toEqual({ region: 'bridge-2', edge: 'end', plus: 3 })
    expect(api.shiftAnchor!(n, { region: 'chorus', hearing: 1, edge: 'start' }, 2, 'from')).toEqual({ region: 'chorus', hearing: 2, edge: 'start' })
    expect(api.shiftAnchor!(n, { region: 'verse-1', edge: 'start' }, -1, 'from')).toBeUndefined()
    expect(api.shiftAnchor!(n, { region: 'verse-2', edge: 'end' }, 1, 'to')).toBeUndefined()
  })

  it('names the regions a stretch covers, for what a new Block is called and made from', () => {
    const covered = api.coveredBy!(turns, 0, startOf(turns, 'chorus') - 1)
    expect(covered).toEqual(['verse-1', 'bridge-1'])
    expect(api.coveredBy!(turns, startOf(turns, 'chorus', 2) + 1, startOf(turns, 'chorus', 2) + 5)).toEqual(['chorus'])
    expect(api.regionIndexOf!(names(song), 'chorus', 4)).toBe(16)
    expect(api.nearestBoundary!(turns, startOf(turns, 'chorus') + 3)).toBe(2)
  })
})

describe('the tempo under each region, as the page works it from a draft', () => {
  it('is what the server resolved: a number, the Mood\'s, or free time', async () => {
    const made = arrangements.find(({ arrangement }) => arrangement.id === 'tempo-turns')!.arrangement
    const under = api.tempoUnder!(names(turns), made.tempo) as (number | 'mood' | null)[]
    expect(under.map((bpm) => (bpm === 'mood' ? 72 : bpm))).toEqual(turns.regions.map(({ tempo }) => tempo))
    expect(api.tempoUnder!(['a', 'b'], undefined)).toEqual(['mood', 'mood'])
  })
})
