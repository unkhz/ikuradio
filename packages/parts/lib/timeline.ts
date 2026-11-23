// The timeline of an Arrangement (plan "Evolution of Song", step 8). The regions (its instances) say what the music is, a Track is a
// lane of what sounds, and a Block is a clip on a Track, placed by anchors to regions, never by coordinates: a region's length is not
// known until its words are fitted. `resolve` turns the anchors into beats and seconds once the regions' lengths are known, and
// `refuseTimeline` says plainly what is wrong with one that cannot be resolved. An Arrangement without a tempo map, tracks or
// blocks is read as it always was: one tempo, the Mood's, and no Block at all.

import { Type, type TSchema } from 'typebox'
import { partialParameters, refusal } from './schema.js'
import type { TrackRecord } from './tracks.js'

/** A place on the timeline: the start or end of a region (the nth time it is heard), or of the whole Song, and so many seconds after (or, if negative, before). */
export type Anchor = { region?: string; hearing?: number; edge: 'start' | 'end'; plus?: number }

/** A clip on a Track: where it begins and ends, what it is made from, and how it comes and goes. Blocks of one key are one sound, made once and placed again. */
export type Block = {
  track: string
  key: string
  from: Anchor
  to: Anchor
  /** The regions, by name, it is made from: the words it sings, the guide it grows from. */
  source?: string[]
  fadeIn?: number
  fadeOut?: number
  gain?: number
}

/** The tempo from a region on, held until the next change: beats a minute, the Mood's own, or none (free time: no beat, no grid). */
export type TempoPoint = { region?: string; hearing?: number; bpm: number | 'mood' | null }

/** What the timeline adds to an Arrangement, by addition. */
export type Timeline = { tempo?: TempoPoint[]; tracks?: string[]; blocks?: Block[] }

/** A region as an Arrangement's instance says it, as far as the timeline needs it. */
export type Region = { name: string; part: string; seconds?: number }

// ---- schemas

const anchor = () =>
  Type.Object(
    {
      region: Type.Optional(Type.String({ minLength: 1 })),
      hearing: Type.Optional(Type.Integer({ minimum: 1 })),
      edge: Type.Union([Type.Literal('start'), Type.Literal('end')]),
      plus: Type.Optional(Type.Number()),
    },
    { additionalProperties: false },
  )

/** A track's id: any name, or, where the Tracks are known, one of them. */
const trackId = (ids?: readonly string[]): TSchema => (ids?.length ? Type.Union(ids.map((id) => Type.Literal(id))) : Type.String({ minLength: 1 }))

const bpm = () => Type.Union([Type.Number({ minimum: 20, maximum: 300 }), Type.Literal('mood'), Type.Null()])

/** The shape of the timeline's three fields: what the schema alone can say. Which Tracks and regions there are is checked beside it. */
export const timelineShape = (trackIds?: readonly string[]) => ({
  tempo: Type.Optional(
    Type.Array(
      Type.Object({ region: Type.Optional(Type.String({ minLength: 1 })), hearing: Type.Optional(Type.Integer({ minimum: 1 })), bpm: bpm() }, { additionalProperties: false }),
      { minItems: 1 },
    ),
  ),
  tracks: Type.Optional(Type.Array(trackId(trackIds))),
  blocks: Type.Optional(
    Type.Array(
      Type.Object(
        {
          track: trackId(trackIds),
          key: Type.String({ minLength: 1 }),
          from: anchor(),
          to: anchor(),
          source: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
          fadeIn: Type.Optional(Type.Number()),
          fadeOut: Type.Optional(Type.Number()),
          gain: Type.Optional(Type.Number()),
        },
        { additionalProperties: false },
      ),
    ),
  ),
})

// ---- where the regions are

/** The index of a region by its name and which hearing of it (the first, unless said), or nothing if there is no such region or hearing. */
export function regionIndex(regions: readonly Region[], name: string, hearing = 1): number | undefined {
  let seen = 0
  for (const [i, region] of regions.entries()) if (region.name === name && ++seen === hearing) return i
  return undefined
}

const heardCount = (regions: readonly Region[], name: string) => regions.filter((region) => region.name === name).length

/**
 * An anchor as a boundary between regions (0 before the first, n after the last), and the seconds beyond it. The start of region i
 * and the end of region i-1 are one instant, the boundary i. Undefined if it names a region, or a hearing, that is not there.
 */
export function boundaryOf(regions: readonly Region[], at: Anchor): { boundary: number; plus: number } | undefined {
  const plus = at.plus ?? 0
  if (at.region === undefined) return { boundary: at.edge === 'start' ? 0 : regions.length, plus }
  const i = regionIndex(regions, at.region, at.hearing)
  return i === undefined ? undefined : { boundary: at.edge === 'start' ? i : i + 1, plus }
}

/** What an anchor names that is not there, in words, or nothing. */
function missing(regions: readonly Region[], at: Anchor): string | undefined {
  if (at.region === undefined) return undefined
  if (boundaryOf(regions, at)) return undefined
  const heard = heardCount(regions, at.region)
  if (heard === 0) return `the Arrangement has no region "${at.region}"`
  return `region "${at.region}" is heard ${heard} time${heard > 1 ? 's' : ''}, not ${at.hearing}`
}

/** The tempo a region is under, from the tempo map: a number, 'mood', or null for free time. */
export function tempoOf(regions: readonly Region[], tempo: readonly TempoPoint[] | undefined): (number | 'mood' | null)[] {
  const under: (number | 'mood' | null)[] = regions.map(() => 'mood')
  if (!tempo?.length) return under
  const changes = tempo.map((point) => ({ at: point.region === undefined ? 0 : (regionIndex(regions, point.region, point.hearing) ?? -1), bpm: point.bpm }))
  for (let r = 0; r < regions.length; r++) {
    let current: (typeof changes)[number] | undefined
    for (const change of changes) if (change.at <= r && change.at >= 0) current = change
    under[r] = current ? current.bpm : 'mood'
  }
  return under
}

/** Which tempo segment each region is in: a new one begins at every change of the tempo map. */
function segmentsOf(regions: readonly Region[], tempo: readonly TempoPoint[] | undefined): number[] {
  const starts = new Set((tempo ?? []).map((point) => (point.region === undefined ? 0 : (regionIndex(regions, point.region, point.hearing) ?? -1))).filter((at) => at >= 0))
  let segment = 0
  return regions.map((_, r) => {
    if (r > 0 && starts.has(r)) segment++
    return segment
  })
}

// ---- resolve

export type ResolvedRegion = {
  index: number
  name: string
  part: string
  /** Beats a minute, or null in free time. */
  tempo: number | null
  /** The tempo segment it is in: it begins at every change of the tempo map. */
  segment: number
  startSeconds: number
  seconds: number
  /** Where it begins, in beats from the start of its segment, and how long it is in beats: none in free time. */
  startBeats?: number
  beats?: number
}

export type ResolvedBlock = {
  index: number
  track: string
  key: string
  source: string[]
  startSeconds: number
  endSeconds: number
  seconds: number
  fadeIn: number
  fadeOut: number
  gain: number
  /** Where it begins in beats from the start of its segment, and how long it is, when the whole of it is under one tempo: otherwise none. */
  startBeats?: number
  beats?: number
}

export type Resolved = { seconds: number; regions: ResolvedRegion[]; blocks: ResolvedBlock[] }

/** What `resolve` is given: how many beats each region lasts (where it has a tempo), and the Mood's tempo, for a region that is under it. */
export type Lengths = { beats: readonly (number | undefined)[]; mood?: number }

/**
 * Every region's and Block's start and length: in seconds, always, and in beats where there is a tempo. A tempo change begins a
 * segment, from whose start the beats count again, and the seconds run on. A region in free time lasts its own seconds. Anything
 * the timeline cannot resolve is said plainly, as `refuseTimeline` says it beforehand.
 */
export function resolve(arrangement: { instances: readonly Region[] } & Timeline, { beats, mood }: Lengths): Resolved {
  const regions = arrangement.instances
  const under = tempoOf(regions, arrangement.tempo)
  const segments = segmentsOf(regions, arrangement.tempo)
  let at = 0
  const placed: ResolvedRegion[] = regions.map((region, index) => {
    const t = under[index]!
    const bpm = t === 'mood' ? mood : t
    let seconds: number
    let length: number | undefined
    if (bpm === null || bpm === undefined) {
      if (t !== null) throw new Error(`region ${index + 1} ("${region.name}"): it is under the Mood's tempo, and none is given`)
      if (region.seconds === undefined) throw new Error(`region ${index + 1} ("${region.name}"): it is in free time, and so needs its seconds`)
      seconds = region.seconds
    } else {
      length = beats[index]
      if (length === undefined) throw new Error(`region ${index + 1} ("${region.name}"): its length in beats is not known`)
      seconds = (length * 60) / bpm
    }
    const placedRegion: ResolvedRegion = { index, name: region.name, part: region.part, tempo: bpm ?? null, segment: segments[index]!, startSeconds: at, seconds }
    at += seconds
    return placedRegion
  })
  // the beats of a region count from the start of its segment
  const segmentStart = new Map<number, number>()
  for (const region of placed) {
    if (region.tempo === null) continue
    const from = segmentStart.get(region.segment) ?? region.startSeconds
    segmentStart.set(region.segment, from)
    region.startBeats = ((region.startSeconds - from) * region.tempo) / 60
    region.beats = (region.seconds * region.tempo) / 60
  }

  const boundarySeconds = (boundary: number) => (boundary >= placed.length ? at : placed[boundary]!.startSeconds)
  /** The region a moment is in: for a start, the one it begins in; for an end, the one it ends in. */
  const regionOf = (seconds: number, side: 'start' | 'end') => {
    for (const region of placed) {
      const end = region.startSeconds + region.seconds
      if (side === 'start' ? seconds >= region.startSeconds && seconds < end : seconds > region.startSeconds && seconds <= end) return region
    }
    return side === 'start' ? placed.at(-1) : placed[0]
  }

  const blocks: ResolvedBlock[] = (arrangement.blocks ?? []).map((block, index) => {
    const from = boundaryOf(regions, block.from)
    const to = boundaryOf(regions, block.to)
    if (!from) throw new Error(`block ${index + 1} ("${block.key}"): ${missing(regions, block.from)}`)
    if (!to) throw new Error(`block ${index + 1} ("${block.key}"): ${missing(regions, block.to)}`)
    const startSeconds = boundarySeconds(from.boundary) + from.plus
    const endSeconds = boundarySeconds(to.boundary) + to.plus
    if (endSeconds < startSeconds) throw new Error(`block ${index + 1} ("${block.key}"): it ends before it begins`)
    const seconds = endSeconds - startSeconds
    const first = regionOf(startSeconds, 'start')
    const last = regionOf(endSeconds, 'end')
    const resolved: ResolvedBlock = { index, track: block.track, key: block.key, source: block.source ?? [], startSeconds, endSeconds, seconds, fadeIn: block.fadeIn ?? 0, fadeOut: block.fadeOut ?? 0, gain: block.gain ?? 1 }
    // in beats only where there is a tempo, and a Block under two tempi has no beats to count
    if (first && last && first.segment === last.segment && first.tempo !== null && first.startBeats !== undefined) {
      resolved.startBeats = first.startBeats + ((startSeconds - first.startSeconds) * first.tempo) / 60
      resolved.beats = (seconds * first.tempo) / 60
    }
    return resolved
  })
  return { seconds: at, regions: placed, blocks }
}

// ---- refusals

/** The shape a Track's Block parameters are checked by: any of them, each within its range. */
const blockSchema = (record: TrackRecord): TSchema => partialParameters(record.track.parameters)

/**
 * The first thing wrong with an Arrangement's timeline, said plainly, or nothing. `parts` are the parts there are, by id, and
 * `tracks` the Tracks. A region in free time needs its seconds and may have no written words; a Block is on a Track that exists,
 * between anchors that name regions that exist, and does not end before it begins; one key is one Track and one source.
 */
export function refuseTimeline(
  arrangement: { instances: readonly Region[] } & Timeline,
  parts: ReadonlyMap<string, { words: string }>,
  tracks: readonly TrackRecord[],
): string | undefined {
  const regions = arrangement.instances
  const byId = new Map(tracks.map((record) => [record.track.id, record]))
  const where = (i: number) => `region ${i + 1} ("${regions[i]!.name}", a ${regions[i]!.part})`

  for (const id of arrangement.tracks ?? []) if (!byId.has(id)) return `the Arrangement names the track "${id}", which does not exist: the tracks are ${[...byId.keys()].join(', ') || 'none'}`

  // the tempo map: its regions are there, in order
  let last = -1
  for (const [i, point] of (arrangement.tempo ?? []).entries()) {
    const at = point.region === undefined ? 0 : regionIndex(regions, point.region, point.hearing)
    if (at === undefined) return `tempo change ${i + 1}: ${missing(regions, { region: point.region, hearing: point.hearing, edge: 'start' })}`
    if (at <= last && i > 0) return `tempo change ${i + 1}: it is at or before the change before it: the tempo map goes forward, one change to a region`
    if (i === 0 && point.region !== undefined && at !== 0) return `tempo change 1: the first change is for the start, since the Song has a tempo from its first moment`
    last = at
  }

  // free time has seconds and no written words; a tempo has no seconds
  const under = tempoOf(regions, arrangement.tempo)
  for (const [i, region] of regions.entries()) {
    if (under[i] === null) {
      // the words first: seconds cannot mend a part that has them
      if (parts.get(region.part)?.words === 'written') return `${where(i)}: it has written words, and cannot be in free time: fitting words needs the beat grid, and free time has none`
      if (region.seconds === undefined) return `${where(i)}: it is in free time, and so needs its seconds`
    } else if (region.seconds !== undefined) return `${where(i)}: it has seconds but is under a tempo: seconds are for a region in free time`
  }

  const keys = new Map<string, { track: string; source: string }>()
  for (const [i, block] of (arrangement.blocks ?? []).entries()) {
    const label = `block ${i + 1} ("${block.key}")`
    const record = byId.get(block.track)
    if (!record) return `${label}: there is no track "${block.track}": the tracks are ${[...byId.keys()].join(', ') || 'none'}`
    const problem = refusal(blockSchema(record), { ...(block.gain !== undefined ? { gain: block.gain } : {}), ...(block.fadeIn !== undefined ? { fadeIn: block.fadeIn } : {}), ...(block.fadeOut !== undefined ? { fadeOut: block.fadeOut } : {}) })
    if (problem) return `${label} on the ${block.track} track: the parameter ${problem}`
    for (const side of ['from', 'to'] as const) {
      const lost = missing(regions, block[side])
      if (lost) return `${label}: its ${side} anchor: ${lost}`
    }
    for (const name of block.source ?? []) if (heardCount(regions, name) === 0) return `${label}: its source names region "${name}", which the Arrangement does not have`
    // a block that ends before it begins, where it can be told without the lengths: the same boundary, or a plain order of boundaries
    const from = boundaryOf(regions, block.from)!
    const to = boundaryOf(regions, block.to)!
    if ((from.boundary === to.boundary && from.plus > to.plus) || (from.boundary > to.boundary && from.plus >= 0 && to.plus <= 0)) return `${label}: it ends before it begins`
    // one key is one sound: one Track, and one source
    const source = JSON.stringify(block.source ?? [])
    const had = keys.get(block.key)
    if (had && had.track !== block.track) return `${label}: the key "${block.key}" is already on the ${had.track} track: one key, one track`
    if (had && had.source !== source) return `${label}: the key "${block.key}" already has another source: one key, one sound, made from one thing`
    keys.set(block.key, { track: block.track, source })
  }
  return undefined
}
