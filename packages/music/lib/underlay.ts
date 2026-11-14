// Laying the Music under an iteration. Each part is accompanied once, from
// the first time it is sung: the voice of that section is given to the
// model, and the bed it grows is laid under every section of the part. All
// verses share a tune, and so they share a bed, though their words differ.

import { createHash } from 'node:crypto'
import { mkdir, rm, stat } from 'node:fs/promises'
import { describe, type Mood } from 'mood'
import { mixdown, type Placed } from 'vocals'
import { accompany, longest, musicDir, tail, words } from './bed.js'
import { sections, type Kind, type Line } from './sections.js'
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
     */
    guides?: ReadonlyMap<Kind, string>
  } = {},
): Promise<{ beds: Placed[]; departed: string[]; grown: number }> {
  const all = sections(lines)
  const song = songOf(mood)
  const beds = new Map<Kind, string>()
  const kinds = [...new Set(all.map(({ kind }) => kind))]
  const departed: string[] = []
  let grown = 0
  for (const section of all) {
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
  if (beds.size === 0) {
    console.warn(`no bed grew under ${describe(mood)}: nothing was sung`)
  }
  return {
    beds: all.flatMap(({ kind, at, seconds }) => {
      const file = beds.get(kind)
      return file ? [{ file, at, gain: bedGain, seconds, fade: tail }] : []
    }),
    departed,
    grown,
  }
}
