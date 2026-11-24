// Laying the Music under an iteration. Each part is accompanied once, from
// the first time it is sung: the voice of that section is given to the
// model, and the bed it grows is laid under every section of the part. All
// verses share a tune, and so they share a bed, though their words differ.

import { createHash } from 'node:crypto'
import { mkdir, rm, stat } from 'node:fs/promises'
import { describe, type Mood } from 'mood'
import { mixdown, type Placed } from 'vocals'
import { accompany, longest, musicDir, tail, words } from './bed.js'
import { sections, type Kind, type Line, type Section } from './sections.js'
import type { Shelf } from './shelf.js'

/** How loud the bed lies under the voice. Under it, never over it. */
export const bedGain = 0.45

async function exists(file: string) {
  try {
    return (await stat(file)).isFile()
  } catch {
    return false
  }
}

/** One section's voice alone, as one recording, from its own beginning. */
async function voiceOf(lines: Line[], from: number): Promise<string> {
  const placed = lines
    .filter(({ file }) => file)
    .map(({ file, at }) => ({ file, at: at - from }))
  const name = createHash('sha256').update(JSON.stringify(placed)).digest('hex')
  const file = `${musicDir}/voice-${name}.m4a`
  if (await exists(file)) return file
  await mkdir(musicDir, { recursive: true })
  await mixdown(placed, file)
  return file
}

/** The Song a Mood belongs to, as the shelf knows it: its weather and its pulse. */
export const songOf = ({ descriptions, character }: Mood) =>
  JSON.stringify({ descriptions, tempo: character.tempo, mode: character.mode })

/**
 * Finds a bed for each part of an iteration and places it under every
 * section of that part. With a shelf, a part may play a bed it has played
 * before in this Song instead of growing a new one. Returns the beds as
 * placed recordings, ready to be mixed under the voice or played beside
 * it, the beds that left the shelf, and how many were grown anew.
 */
export async function underlay(
  lines: Line[],
  mood: Mood,
  {
    shelf,
    iteration = 0n,
    guides,
    bridgeBeds,
  }: {
    shelf?: Shelf
    iteration?: bigint
    /**
     * What the bridges' beds are told instead of the Mood's band, and
     * whether they follow the guide's melody: a Song's Perspective on its
     * bridges. Without it, a bridge's bed is grown like any other.
     */
    bridgeBeds?: { instead?: string; melody: boolean }
    /**
     * A guide hum for each kind of bed, the lead's slow reading of its
     * melody: what the Music listens to, if given, instead of the sung voice.
     * A guide given for a section by its place in the iteration, from 0, is
     * that section's own: the section grows its own bed from it, and plays
     * an old one only if it grew from the very same guide.
     */
    guides?: ReadonlyMap<Kind | number, string>
  } = {},
): Promise<{ beds: Placed[]; departed: string[]; grown: number }> {
  const all = sections(lines)
  const song = songOf(mood)
  const beds = new Map<Kind, string>()
  const own = new Map<number, string>()
  const kinds = [...new Set(all.map(({ kind }) => kind))]
  const departed: string[] = []
  let grown = 0
  for (const [i, section] of all.entries()) {
    const guided = guides?.get(i)
    if (guided) {
      // a section with a guide of its own: its own bed, from the shelf only if it grew from this guide
      const kept = shelf?.grownFrom(song, guided)
      if (kept) {
        own.set(i, kept)
        continue
      }
      const turned = section.part === 'bridge' ? bridgeBeds : undefined
      const bed = await accompany({
        vocals: guided,
        mood: turned?.instead ? `${turned.instead}, ${mood.character.tempo} bpm` : words(mood),
        seconds: section.seconds + tail,
        melody: turned?.melody ?? true,
      })
      own.set(i, bed)
      grown++
      if (shelf) departed.push(...shelf.keepGuided(song, section.kind, guided, bed, Math.min(longest, section.seconds + tail)))
      continue
    }
    if (beds.has(section.kind)) continue
    const guide = guides?.get(section.kind)
    if (!guide && !section.lines.some(({ file }) => file)) continue
    // a bed from the shelf must last as long as this section, and fade under what follows
    const choice = shelf?.choose(iteration, song, section.kind, kinds, section.seconds + tail)
    if (choice && !choice.grow) {
      beds.set(section.kind, choice.bed)
      continue
    }
    // the Music follows the guide if there is one: a melody moving too fast distracts it
    const vocals = guide ?? (await voiceOf(section.lines, section.at))
    // a section's sung voice is only what the Music listens to; once heard, it is let go
    const turned = section.part === 'bridge' ? bridgeBeds : undefined
    const bed = await accompany({
      vocals,
      // the tempo is always told; what plays may be the Perspective's, not the Mood's band
      mood: turned?.instead ? `${turned.instead}, ${mood.character.tempo} bpm` : words(mood),
      // grown a little longer than its place, to fade under what follows
      seconds: section.seconds + tail,
      melody: turned?.melody ?? true,
    }).finally(() => (guide ? undefined : rm(vocals, { force: true })))
    beds.set(section.kind, bed)
    grown++
    if (shelf) departed.push(...shelf.keep(song, section.kind, bed, Math.min(longest, section.seconds + tail)))
  }
  if (beds.size === 0 && own.size === 0) {
    console.warn(`no bed grew under ${describe(mood)}: nothing was sung`)
  }
  return {
    beds: all.flatMap(({ kind, at, seconds }, i) => {
      const file = own.get(i) ?? beds.get(kind)
      return file ? [{ file, at, gain: bedGain, seconds, fade: tail }] : []
    }),
    departed,
    grown,
  }
}

/** A bed a timeline asks for: its key, the kind of section it lies under, the guide it grows from, and how long it is made (its longest placing, tail included). */
export type BedAsked = {
  key: string
  kind: Kind
  part: string
  /** The guide hum it grows from. A bed whose guide could not be hummed is grown from the sung voice of `section` instead. */
  guide?: string
  seconds: number
  /** The tempo of the region it lies under, if it differs from the Mood's (`null` for free time). */
  tempo?: number | null
  /** The section it lies under, as it was sung: only for a bed without a guide. */
  section?: Section
}

/**
 * Grows the beds a timeline asks for, each key once, in the order they are asked. A bed from a guide of its own is taken from the shelf only if it grew from that very
 * guide, as `underlay` does; a bed without one is grown from the voice by the shelf's rules for its kind. A key placed again is the one bed, placed again by whoever lays it.
 * Returns the bed of each key, the beds that left the shelf, and how many were grown anew.
 */
export async function growBeds(
  asked: readonly BedAsked[],
  mood: Mood,
  { shelf, iteration = 0n, bridgeBeds }: { shelf?: Shelf; iteration?: bigint; bridgeBeds?: { instead?: string; melody: boolean } } = {},
): Promise<{ beds: Map<string, string>; departed: string[]; grown: number }> {
  const song = songOf(mood)
  const beds = new Map<string, string>()
  const byKind = new Map<string, { file: string; seconds: number }>()
  const kinds = [...new Set(asked.map(({ kind }) => kind))]
  const departed: string[] = []
  let grown = 0
  for (const ask of asked) {
    const turned = ask.part === 'bridge' ? bridgeBeds : undefined
    const atMood = ask.tempo === undefined || ask.tempo === mood.character.tempo
    const told = turned?.instead
      ? ask.tempo === null
        ? `${turned.instead}, free time`
        : `${turned.instead}, ${ask.tempo ?? mood.character.tempo} bpm`
      : words(mood, ask.tempo)
    const kindKey = atMood ? ask.kind : `${ask.kind}@${ask.tempo === null ? 'free' : ask.tempo}`
    if (ask.guide) {
      const kept = atMood ? shelf?.grownFrom(song, ask.guide) : undefined
      if (kept) {
        beds.set(ask.key, kept)
        continue
      }
      const bed = await accompany({ vocals: ask.guide, mood: told, seconds: ask.seconds, melody: turned?.melody ?? true })
      beds.set(ask.key, bed)
      grown++
      // never store non-mood or free-time guided beds in the Mood-tempo shelf, where an unguided section could pick them later
      if (atMood && shelf) departed.push(...shelf.keepGuided(song, ask.kind, ask.guide, bed, Math.min(longest, ask.seconds)))
      continue
    }
    // no guide: the kind's bed, as the shelf chooses it, grown from the sung voice (never reusing a bed from another tempo or shorter than needed)
    const had = byKind.get(kindKey)
    if (had && had.seconds >= Math.min(longest, ask.seconds)) {
      beds.set(ask.key, had.file)
      continue
    }
    if (!ask.section?.lines.some(({ file }) => file)) continue
    const choice = atMood ? shelf?.choose(iteration, song, ask.kind, kinds, ask.seconds) : undefined
    if (choice && !choice.grow) {
      byKind.set(kindKey, { file: choice.bed, seconds: Math.min(longest, ask.seconds) })
      beds.set(ask.key, choice.bed)
      continue
    }
    const vocals = await voiceOf(ask.section.lines, ask.section.at)
    const bed = await accompany({ vocals, mood: told, seconds: ask.seconds, melody: turned?.melody ?? true }).finally(() => rm(vocals, { force: true }))
    const lasted = Math.min(longest, ask.seconds)
    byKind.set(kindKey, { file: bed, seconds: lasted })
    beds.set(ask.key, bed)
    grown++
    if (atMood && shelf) departed.push(...shelf.keep(song, ask.kind, bed, lasted))
  }
  if (beds.size === 0) console.warn(`no bed grew under ${describe(mood)}: nothing was sung`)
  return { beds, departed, grown }
}
