// The Arrangements there are, found by reading this package's `arrangements/` folders: a folder is an
// Arrangement if it holds a declaration (arrangement.json) and a record (arrangement.md). One whose
// declaration is refused fails loudly, naming the folder and the refusal.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { refuseArrangement, type Arrangement } from './arrangement.js'
import { parseRecord, type RecordState } from './record.js'
import type { PartRecord } from './registry.js'

/** An Arrangement as its declaration and its record say it is. */
export type ArrangementRecord = { arrangement: Arrangement; slug: string; title: string; text: string; state: RecordState; dir: string }

/** Where the Arrangements live: a folder each. */
export const arrangementsHome = fileURLToPath(new URL('../arrangements/', import.meta.url))

/** Every Arrangement there is, in the order of their ids; one whose declaration is refused stops the reading. */
export function readArrangements(records: readonly PartRecord[], home = arrangementsHome): ArrangementRecord[] {
  const found: ArrangementRecord[] = []
  if (!existsSync(home)) return found
  for (const entry of readdirSync(home, { withFileTypes: true })) {
    const dir = join(home, entry.name)
    if (!entry.isDirectory() || !existsSync(join(dir, 'arrangement.json')) || !existsSync(join(dir, 'arrangement.md'))) continue
    const record = parseRecord(readFileSync(join(dir, 'arrangement.md'), 'utf8'), dir, "an Arrangement's")
    const declared: unknown = JSON.parse(readFileSync(join(dir, 'arrangement.json'), 'utf8'))
    const refused = refuseArrangement(declared, records)
    if (refused) throw new Error(`${dir}: ${refused}`)
    const arrangement = declared as Arrangement
    if (arrangement.id !== entry.name || record.slug !== entry.name) throw new Error(`${dir}: an Arrangement's id is its folder's, in its record and its declaration alike`)
    found.push({ ...record, arrangement, dir })
  }
  return found.sort((a, b) => a.arrangement.id.localeCompare(b.arrangement.id))
}
