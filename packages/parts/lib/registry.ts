// The parts there are, found by reading this package's folders: a folder is a part
// if it holds a record (part.md) and a module (part.ts). No list of ids is written
// anywhere in code: adding a part is adding a folder.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Part } from './part.js'

/** A part as its record and its module say it is. */
export type PartRecord = { part: Part; slug: string; title: string; state: 'draft' | 'active' | 'retired'; dir: string }

/** Where the parts live: a folder each, beside this package's own code. */
export const partsHome = fileURLToPath(new URL('../', import.meta.url))

/** A record's state, slug and title, from its frontmatter and heading. */
function parseRecord(text: string, dir: string) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) throw new Error(`${dir}: a part's record begins with frontmatter`)
  const fields = Object.fromEntries(
    match[1]!.split('\n').flatMap((line) => {
      const at = line.indexOf(':')
      return at > 0 ? [[line.slice(0, at).trim(), line.slice(at + 1).trim()]] : []
    }),
  )
  const title = /^# (.+)$/m.exec(text.slice(match[0].length))?.[1]?.trim() ?? fields.slug
  return { slug: fields.slug as string, title: title as string, state: fields.state as PartRecord['state'] }
}

/** Every part there is, in the order of their ids; the id a part declares is its folder's. */
export async function readParts(home = partsHome): Promise<PartRecord[]> {
  const found: PartRecord[] = []
  for (const entry of readdirSync(home, { withFileTypes: true })) {
    const dir = join(home, entry.name)
    if (!entry.isDirectory() || !existsSync(join(dir, 'part.md')) || !existsSync(join(dir, 'part.ts'))) continue
    const record = parseRecord(readFileSync(join(dir, 'part.md'), 'utf8'), dir)
    const part = (await import(join(dir, 'part.ts'))).default as Part
    if (!(part instanceof Part)) throw new Error(`${dir}: a part's module exports an instance of a Part`)
    if (part.id !== entry.name || record.slug !== entry.name) throw new Error(`${dir}: a part's id is its folder's, in its record and its module alike`)
    found.push({ ...record, part, dir })
  }
  return found.sort((a, b) => a.part.id.localeCompare(b.part.id))
}

/** The parts by id: only the active ones are for an Arrangement to choose. */
export async function partsById(home = partsHome): Promise<Map<string, Part>> {
  return new Map((await readParts(home)).filter(({ state }) => state === 'active').map(({ part }) => [part.id, part]))
}
