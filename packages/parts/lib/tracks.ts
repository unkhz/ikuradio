// The Tracks there are, found by reading this package's `tracks/` folders: a folder is a Track if it holds a record (track.md) and a
// module (track.ts). No list of ids is written anywhere in code: adding a Track is adding a folder.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRecord, type RecordState } from './record.js'
import { Track } from './track.js'

/** A Track as its record and its module say it is. */
export type TrackRecord = { track: Track; slug: string; title: string; text: string; state: RecordState; dir: string }

/** Where the Tracks live: a folder each. */
export const tracksHome = fileURLToPath(new URL('../tracks/', import.meta.url))

/** Every Track there is, in the order of their ids; the id a Track declares is its folder's. */
export async function readTracks(home = tracksHome): Promise<TrackRecord[]> {
  const found: TrackRecord[] = []
  if (!existsSync(home)) return found
  for (const entry of readdirSync(home, { withFileTypes: true })) {
    const dir = join(home, entry.name)
    if (!entry.isDirectory() || !existsSync(join(dir, 'track.md')) || !existsSync(join(dir, 'track.ts'))) continue
    const record = parseRecord(readFileSync(join(dir, 'track.md'), 'utf8'), dir, "a Track's")
    const track = (await import(join(dir, 'track.ts'))).default as Track
    if (!(track instanceof Track)) throw new Error(`${dir}: a Track's module exports an instance of a Track`)
    if (track.id !== entry.name || record.slug !== entry.name) throw new Error(`${dir}: a Track's id is its folder's, in its record and its module alike`)
    found.push({ ...record, track, dir })
  }
  return found.sort((a, b) => a.track.id.localeCompare(b.track.id))
}
