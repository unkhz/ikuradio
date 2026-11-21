// The concepts of a Song, as the Composer's map shows them (plan "Evolution of Song", step 5). Each is a folder in
// `concepts/`: its record (concept.md, whose frontmatter says its `band` and the concepts it `leads` into), the
// module that gives its page's data (data.ts) and the script that draws the page (view.js). The folders are found
// by reading them: no list of concepts, and no list of links, is written in code. Adding a concept is adding a folder.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRecord, type PartRecord } from 'parts'

/** The three bands a concept stands in, top to bottom on the map, and what each says. */
export const bands = [
  { id: 'shapes', says: 'Shapes it' },
  { id: 'edits', says: 'Composer edits' },
  { id: 'made', says: 'Made every Song' },
] as const
export type Band = (typeof bands)[number]['id']

/** What a data.ts is given: the parts and where the Arrangements are, and a tempo. */
export type Context = { records: readonly PartRecord[]; arrangementsDir: string; tempo: number }

export type Concept = {
  id: string
  title: string
  band: Band
  leads: string[]
  /** The first paragraph of its record: the short line a box shows. */
  line: string
  /** The paragraphs after it. */
  more: string[]
  state: 'draft' | 'active' | 'retired'
  /** Its number, from its record: the order they are drawn in within a band. */
  number: number
  dir: string
  data: (context: Context) => unknown | Promise<unknown>
}

/** Where the concepts live. */
export const conceptsHome = fileURLToPath(new URL('../concepts/', import.meta.url))

/** Names the Composer's own routes answer: a concept cannot take one. */
const reserved = new Set(['concepts', 'check', 'arrangements', 'public'])

/** Every concept there is, in the order of their numbers; a folder that is not whole, or that leads where there is no concept, stops the reading, naming the folder. */
export async function readConcepts(home = conceptsHome): Promise<Concept[]> {
  const found: Concept[] = []
  if (!existsSync(home)) return found
  for (const entry of readdirSync(home, { withFileTypes: true })) {
    const dir = join(home, entry.name)
    if (!entry.isDirectory() || !existsSync(join(dir, 'concept.md'))) continue
    for (const file of ['data.ts', 'view.js']) if (!existsSync(join(dir, file))) throw new Error(`${dir}: a concept has its ${file}, and this one does not`)
    const record = parseRecord(readFileSync(join(dir, 'concept.md'), 'utf8'), dir, "a concept's")
    if (record.slug !== entry.name) throw new Error(`${dir}: a concept's id is its folder's`)
    if (reserved.has(entry.name) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) throw new Error(`${dir}: "${entry.name}" cannot be a concept's id`)
    const band = record.fields.band as Band
    if (!bands.some(({ id }) => id === band)) throw new Error(`${dir}: its band is "${record.fields.band}", and the bands are ${bands.map(({ id }) => id).join(', ')}`)
    const [line = '', ...more] = record.text.split(/\n\s*\n/).map((paragraph) => paragraph.replace(/\s+/g, ' ').trim()).filter(Boolean)
    const data = (await import(join(dir, 'data.ts'))).default
    if (typeof data !== 'function') throw new Error(`${dir}: a concept's data.ts exports a function`)
    found.push({
      id: entry.name,
      title: record.title,
      band,
      leads: (record.fields.leads ?? '').split(',').map((lead) => lead.trim()).filter(Boolean),
      line,
      more,
      state: record.state,
      number: /^\d+$/.test(record.fields.id ?? '') ? Number(record.fields.id) : Number.MAX_SAFE_INTEGER,
      dir,
      data,
    })
  }
  found.sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))
  const ids = new Set(found.map(({ id }) => id))
  for (const concept of found) {
    for (const lead of concept.leads) {
      if (!ids.has(lead)) throw new Error(`${concept.dir}: it leads into "${lead}", which is not a concept`)
      if (lead === concept.id) throw new Error(`${concept.dir}: a concept does not lead into itself`)
    }
  }
  return found
}
