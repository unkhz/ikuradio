// Laying the Music under an iteration. Each part is accompanied once, from
// the first time it is sung: the voice of that section is given to the
// model, and the bed it grows is laid under every section of the part. All
// verses share a tune, and so they share a bed, though their words differ.

import { createHash } from 'node:crypto'
import { mkdir, stat } from 'node:fs/promises'
import { describe, type Mood } from 'mood'
import { mixdown, type Placed } from 'vocals'
import { accompany, musicDir, words } from './bed.js'
import { sections, type Line } from './sections.js'

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

/**
 * Grows a bed for each part of an iteration and places it under every
 * section of that part. Returns the beds as placed recordings, ready to be
 * mixed under the voice or played beside it.
 */
export async function underlay(lines: Line[], mood: Mood): Promise<Placed[]> {
  const all = sections(lines)
  const beds = new Map<Line['part'], string>()
  for (const section of all) {
    if (beds.has(section.part)) continue
    if (!section.lines.some(({ file }) => file)) continue
    const vocals = await voiceOf(section.lines, section.at)
    beds.set(
      section.part,
      await accompany({ vocals, mood: words(mood), seconds: section.seconds }),
    )
  }
  if (beds.size === 0) {
    console.warn(`no bed grew under ${describe(mood)}: nothing was sung`)
  }
  return all.flatMap(({ part, at }) => {
    const file = beds.get(part)
    return file ? [{ file, at, gain: bedGain }] : []
  })
}
