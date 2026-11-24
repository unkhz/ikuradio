// The Arrangements there are, found by reading this package's `arrangements/` folders: a folder is an
// Arrangement if it holds a declaration (arrangement.json) and a record (arrangement.md). One whose
// declaration is refused fails loudly, naming the folder and the refusal.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { refuseArrangement, type Arrangement } from './arrangement.js'
import { parseRecord, type RecordState } from './record.js'
import type { PartRecord } from './registry.js'
import { readTracks, type TrackRecord } from './tracks.js'

/** An Arrangement as its declaration and its record say it is. */
export type ArrangementRecord = { arrangement: Arrangement; slug: string; title: string; text: string; state: RecordState; weight: number; dir: string }

/** Where the Arrangements live: a folder each. */
export const arrangementsHome = fileURLToPath(new URL('../arrangements/', import.meta.url))

/** How likely an Arrangement is to be drawn when none is pinned: integer 0..10, or 1 if not given. */
function weightOf(raw: string | undefined, dir: string): number {
  if (raw === undefined) return 1
  if (raw.trim() === '') throw new Error(`${dir}: weight must be an integer from 0 to 10, got ""`)
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 10) throw new Error(`${dir}: weight must be an integer from 0 to 10, got "${raw}"`)
  return n
}

/** Every Arrangement there is, in the order of their ids; one whose declaration is refused stops the reading. */
export async function readArrangements(records: readonly PartRecord[], home = arrangementsHome, tracks?: readonly TrackRecord[]): Promise<ArrangementRecord[]> {
  const found: ArrangementRecord[] = []
  if (!existsSync(home)) return found
  // an Arrangement with a timeline is checked against the Tracks there are, unless the Tracks are given
  const known = tracks ?? (await readTracks())
  for (const entry of readdirSync(home, { withFileTypes: true })) {
    const dir = join(home, entry.name)
    if (!entry.isDirectory() || !existsSync(join(dir, 'arrangement.json')) || !existsSync(join(dir, 'arrangement.md'))) continue
    const record = parseRecord(readFileSync(join(dir, 'arrangement.md'), 'utf8'), dir, "an Arrangement's")
    const declared: unknown = JSON.parse(readFileSync(join(dir, 'arrangement.json'), 'utf8'))
    const refused = refuseArrangement(declared, records, known)
    if (refused) throw new Error(`${dir}: ${refused}`)
    const arrangement = declared as Arrangement
    if (arrangement.id !== entry.name || record.slug !== entry.name) throw new Error(`${dir}: an Arrangement's id is its folder's, in its record and its declaration alike`)
    found.push({ ...record, weight: weightOf(record.fields.weight, dir), arrangement, dir })
  }
  return found.sort((a, b) => a.arrangement.id.localeCompare(b.arrangement.id))
}
