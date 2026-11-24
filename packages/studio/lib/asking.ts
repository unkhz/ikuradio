// What an Arrangement's timeline asks the Studio to make (plan "The Studio on timelines", step 4). `makingsOf` lists, for each Track, every distinct key once, its source
// regions, its longest placing and every place it is played. This module reads that list as the Studio needs it: an iteration's regions, in order, with the words each sings,
// and the voices, guides and beds asked for under it. `perform` sings the regions, `humGuides` hums the guides asked for, and `underlay` grows the beds asked for, each by key.
// The keys name the sound; the placings say where it lies. A key is made once and placed as often as the timeline places it.

import { fieldsOf, iterationsOf, makingsOf, resolve, type Arrangement, type Part, type Resolved, type ToMake, type TrackRecord, type WordMode } from 'parts'
import { lyricsOf, type Lyrics } from 'song'
import type { Kind } from 'music'
import type { Placed } from 'vocals'
import type { Guide } from './guide.js'
import type { SungLine } from './perform.js'

/** A region of an iteration: its place in the iteration, from 0, what it is, and the Lyrics key it sings or speaks (wordless/silent regions have none). */
export type Region = {
  /** From the start of the Song. */
  global: number
  /** From the start of the iteration. */
  index: number
  name: string
  part: string
  field?: string
  /** Word mode of the Part (`written`, `spoken`, `none`, `silent`). */
  words?: WordMode
  /** Explicit per-instance parameters from the Arrangement, if any (layered over Tides and Perspectives). */
  parameters?: Readonly<Record<string, number>>
  /** Per-block voice orchestration parameters (`singers`, `breath`, `humanness`) from the voice Block covering this region, if any. */
  voice?: Readonly<Record<string, number | string>>
  /** Explicit cadence from the Arrangement, if any (`full` or `half`). */
  ending?: 'full' | 'half'
  /** The resolved tempo this region is under: beats a minute, or null for free time. */
  tempo?: number | null
  /** Fixed duration in seconds, for a free-time region. */
  seconds?: number
}

/** What is asked of one iteration: its regions, and every voice, guide, bed, drone and pulse key under them. */
export type Asked = {
  regions: Region[]
  voices: ToMake[]
  guides: ToMake[]
  beds: ToMake[]
  drones: ToMake[]
  pulses: ToMake[]
}

/** What an Arrangement asks, by iteration. `resolved` is the timeline it was read from, with the lengths it was given. */
export type Asking = { passes: Asked[]; resolved: Resolved; passOf: number[] }

/**
 * What the timeline asks to be made. `measured` are the seconds each region lasts, if they are known (after the lines are sung); without them every region is given a
 * second at a tempo of 60, since the keys, their sources and where they lie in the order do not depend on how long a region is or on the tempo.
 */
export function askedOf(
  arrangement: Arrangement,
  tracks: readonly TrackRecord[],
  measured?: readonly number[],
  mood = 60,
  parts?: ReadonlyMap<string, Part>,
): Asking {
  const instances = arrangement.instances
  const passOf = iterationsOf(instances, arrangement.turns)
  const passes = Math.max(0, ...passOf) + 1
  const fields = fieldsOf(instances, undefined, parts)
  const defaultSeconds = instances.map((one) => {
    if (one.seconds !== undefined) return one.seconds
    const part = parts?.get(one.part)
    const fromPart = part?.durationSeconds?.(mood, one.parameters ?? {})
    return fromPart !== undefined && fromPart > 0 ? fromPart : 1
  })
  const resolved = resolve(arrangement, { seconds: measured ?? defaultSeconds, mood })
  const asked = makingsOf(resolved, tracks)
  const same = 1e-6
  const regionAt = (at: number) => {
    const exact = resolved.regions.findIndex((region) => Math.abs(region.startSeconds - at) < same)
    if (exact >= 0) return exact
    const inside = resolved.regions.findIndex((region) => at >= region.startSeconds - same && at < region.startSeconds + region.seconds - same)
    if (inside >= 0) return inside
    return at < 0 ? 0 : resolved.regions.length - 1
  }
  // map each global region index to any per-block voice parameters (`singers`, `breath`, `humanness`)
  const voiceParamsByRegion = new Map<number, Readonly<Record<string, number | string>>>()
  for (const making of asked) {
    if (making.track !== 'voice') continue
    for (const placing of making.placings) {
      if (placing.parameters && Object.keys(placing.parameters).length) {
        voiceParamsByRegion.set(regionAt(placing.at), placing.parameters)
      }
    }
  }
  const inPass: Asked[] = []
  for (let pass = 0; pass < passes; pass++) {
    const regions: Region[] = []
    for (const [global, instance] of instances.entries()) {
      if (passOf[global] !== pass) continue
      const regionTempo = resolved.regions[global]!.tempo
      const partObj = parts?.get(instance.part)
      const voiceParams = voiceParamsByRegion.get(global)
      regions.push({
        global,
        index: regions.length,
        name: instance.name,
        part: instance.part,
        ...(fields[global] ? { field: fields[global] } : {}),
        ...(partObj ? { words: partObj.words } : {}),
        ...(instance.parameters && Object.keys(instance.parameters).length ? { parameters: instance.parameters } : {}),
        ...(voiceParams ? { voice: voiceParams } : {}),
        ...(instance.ending ? { ending: instance.ending } : {}),
        tempo: regionTempo,
        ...(instance.seconds !== undefined ? { seconds: instance.seconds } : {}),
      })
    }
    const here = (making: ToMake) => making.placings.length > 0 && passOf[regionAt(making.placings[0]!.at)] === pass
    inPass.push({
      regions,
      voices: asked.filter((making) => making.track === 'voice' && here(making)),
      guides: asked.filter((making) => making.track === 'guide' && here(making)),
      beds: asked.filter((making) => making.track === 'bed' && here(making)),
      drones: asked.filter((making) => making.track === 'drone' && here(making)),
      pulses: asked.filter((making) => making.track === 'pulse' && here(making)),
    })
  }
  return { passes: inPass, resolved, passOf }
}

/**
 * The region of an iteration a key is made from: matches the source name at the key's first placing (or tempo), falling back to the first region with that name.
 * That way a 96-bpm chorus key resolves to the 96-bpm chorus region rather than an earlier 72-bpm hearing of the same name.
 */
export function sourceOf(asked: Asked, making: ToMake): Region {
  const [name] = making.source
  const matches = asked.regions.filter((one) => one.name === name)
  if (matches.length === 0) throw new Error(`${making.key} is made from "${name ?? 'nothing'}", which this iteration does not have`)
  if (matches.length === 1) return matches[0]!
  const placingBpm = making.placings[0]?.bpm
  if (placingBpm !== undefined) {
    const byTempo = matches.find((one) => one.tempo === placingBpm)
    if (byTempo) return byTempo
  }
  return matches[0]!
}

/** What kind of bed lies under a region: its part, or for a bridge the part it leaves and the part it leads to, as the Music knows it. */
export function kindOf(regions: readonly Region[], index: number): Kind {
  const region = regions[index]!
  if (region.part !== 'bridge') return region.part
  const from = regions[index - 1]?.part === 'chorus' ? 'chorus' : 'verse'
  const to = regions[index + 1]?.part === 'chorus' ? 'chorus' : 'verse'
  return `bridge:${from}>${to}`
}

/** The parts of an iteration as `perform` walks them: each region, with the words its field has in the Lyrics. Wordless and silent parts have none. */
export const partsOf = (regions: readonly Region[], lyrics: Lyrics, parts?: ReadonlyMap<string, Part>) =>
  regions.map(({ part, field, words, index, parameters, voice, ending, tempo, seconds }) => {
    const partObj = parts?.get(part)
    return {
      type: part,
      content: field ? (lyricsOf(lyrics, field) ?? '') : '',
      index,
      ...(words ?? partObj?.words ? { words: words ?? partObj?.words } : {}),
      ...(partObj ? { part: partObj } : {}),
      ...(parameters ? { parameters } : {}),
      ...(voice ? { voice } : {}),
      ...(ending ? { ending } : {}),
      ...(tempo !== undefined ? { tempo } : {}),
      ...(seconds !== undefined ? { seconds } : {}),
    }
  })

/** A bed as placed in an iteration: the recording, where the timeline places it, and the key it was grown for. */
export type KeyedBed = Placed & { key: string }

/**
 * The lines each region of an iteration was sung in, from the lines as `perform` laid them end to end, and how long each region lasts: from where its first line begins
 * to where its last ends. A region with no words (a bridge, interlude, or silence) is one line. Lines are in the order of the regions.
 */
export function measure(regions: readonly Region[], lyrics: Lyrics, lines: readonly SungLine[]): { lines: SungLine[][]; seconds: number[] } {
  let cursor = 0
  const found: SungLine[][] = []
  const seconds: number[] = []
  for (const { field } of regions) {
    const text = field === undefined ? '' : (lyricsOf(lyrics, field) ?? '')
    const count = field === undefined ? 1 : Math.max(1, text.split('\n').filter((line) => line.trim()).length)
    const own = lines.slice(cursor, cursor + count)
    cursor += count
    found.push(own)
    const at = own[0]?.at ?? 0
    seconds.push(Math.max(at, ...own.map((line) => line.at + line.seconds)) - at)
  }
  return { lines: found, seconds }
}

/**
 * What an iteration made by key is laid as: a guide for each place its key is placed, and a bed for each place a bed key is placed, in the order of the timeline, with
 * the moments from the start of the iteration. A guide or bed that was not made (its guide could not be hummed, its bed did not come) has none to place.
 */
export function laid(asking: Asking, pass: number, guides: readonly Guide[], beds: ReadonlyMap<string, string>): { guides: Guide[]; beds: KeyedBed[] } {
  const asked = asking.passes[pass]!
  const offset = asking.resolved.regions[asked.regions[0]!.global]!.startSeconds
  const byKey = new Map(guides.map((guide) => [guide.key, guide]))
  const ordered = (list: ToMake[]) => list.flatMap((making) => making.placings.map((placing) => ({ making, placing }))).sort((a, b) => a.placing.at - b.placing.at)
  return {
    guides: ordered(asked.guides).flatMap(({ making, placing }) => {
      const guide = byKey.get(making.key)
      return guide ? [{ ...guide, at: placing.at - offset, seconds: placing.seconds }] : []
    }),
    beds: ordered(asked.beds).flatMap(({ making, placing }) => {
      const file = beds.get(making.key)
      // a bed's place is its Block less its tail: what it holds beyond fades under what follows
      return file
        ? [{ key: making.key, file, at: placing.at - offset, gain: placing.gain, seconds: Math.max(0, placing.seconds - placing.fadeOut), ...(placing.fadeIn ? { fadeIn: placing.fadeIn } : {}), ...(placing.fadeOut ? { fade: placing.fadeOut } : {}) }]
        : []
    }),
  }
}

/**
 * Where the timeline's beds and guides lie, against where the iteration's sections lie as it was sung: the check that makes by key keeps what making by section
 * kept. Every bed and guide placing begins where a section begins, a guide lasts what its section lasts, a bed that and the tail. Says each difference.
 */
export function againstSections(placed: { guides: readonly Guide[]; beds: readonly KeyedBed[] }, found: readonly { at: number; seconds: number }[]): string[] {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-3
  const said: string[] = []
  if (placed.guides.length > 0 && placed.guides.length !== found.length) said.push(`${placed.guides.length} guides are placed for ${found.length} sections`)
  for (const [i, guide] of placed.guides.entries()) {
    const section = found[i]
    if (section && (!near(guide.at, section.at) || !near(guide.seconds, section.seconds))) said.push(`guide ${i + 1} lies at ${guide.at} for ${guide.seconds} s, its section at ${section.at} for ${section.seconds} s`)
  }
  for (const [i, bed] of placed.beds.entries()) {
    const section = found.find((one) => near(one.at, bed.at))
    if (!section) said.push(`bed ${i + 1} (${bed.key}) lies at ${bed.at}, where no section begins`)
    else if (!near(bed.seconds ?? 0, section.seconds)) said.push(`bed ${i + 1} (${bed.key}) lasts ${bed.seconds} s, its section ${section.seconds} s`)
  }
  return said
}
