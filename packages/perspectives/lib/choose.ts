// Choosing a Song's Perspectives. When a Song begins, a few are drawn from
// the active ones, by weight, never two on the same Facet, from the
// wrongness of the Song's number: the same Song always gets the same ones.
// Then each Turns its Facet, and what comes out (the Settings) is what the
// Studio's hooks follow for the whole Song.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { wrongness } from 'melody'
import { defaults, facets, type Actions, type Facet, type Settings } from './facets.js'

/** Where the Perspectives live: a folder each, beside this package's own code. */
export const perspectivesHome = fileURLToPath(new URL('../', import.meta.url))

/** A Perspective as its record says it is. */
export type PerspectiveRecord = {
  slug: string
  title: string
  facet: Facet
  weight: number
  state: 'draft' | 'active' | 'retired'
  /** Its folder, where actions.ts and prompts.json are. */
  dir: string
}

/** A Perspective a Song was heard from: what it turned, and the variant chosen, if any. */
export type Chosen = { slug: string; title: string; facet: Facet; variant?: string }

/** Reads a record's stored fields from its frontmatter, and its title from its heading. */
export function parseRecord(text: string, dir: string): PerspectiveRecord {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) throw new Error(`${dir}: a Perspective record begins with frontmatter`)
  const fields = Object.fromEntries(
    match[1].split('\n').flatMap((line) => {
      const at = line.indexOf(':')
      return at > 0 ? [[line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^"(.*)"$/, '$1')]] : []
    }),
  )
  const title = /^# (.+)$/m.exec(text.slice(match[0].length))?.[1].trim() ?? fields.slug
  const facet = fields.facet as Facet
  if (!facets.includes(facet)) throw new Error(`${dir}: no such Facet: ${fields.facet}`)
  const weight = Number(fields.weight)
  if (!Number.isInteger(weight) || weight < 1 || weight > 10) throw new Error(`${dir}: weight is 1 to 10`)
  return { slug: fields.slug, title, facet, weight, state: fields.state as PerspectiveRecord['state'], dir }
}

/** Every Perspective there is, in the order of their names. */
export function readPerspectives(home = perspectivesHome): PerspectiveRecord[] {
  return readdirSync(home, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(home, entry.name, 'perspective.md')))
    .map((entry) => parseRecord(readFileSync(join(home, entry.name, 'perspective.md'), 'utf8'), join(home, entry.name)))
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

/**
 * Draws `count` active Perspectives for a Song, by weight and without
 * putting two on one Facet. Fewer are drawn if fewer Facets are left.
 */
export function draw(records: readonly PerspectiveRecord[], song: string, count: number): PerspectiveRecord[] {
  const random = wrongness(`perspectives:${song}`)
  const drawn: PerspectiveRecord[] = []
  for (let k = 0; k < count; k++) {
    const open = records.filter(
      (r) => r.state === 'active' && !drawn.some((d) => d.facet === r.facet),
    )
    if (open.length === 0) break
    let left = random() * open.reduce((sum, r) => sum + r.weight, 0)
    const chosen = open.find((r) => (left -= r.weight) < 0) ?? open.at(-1)!
    drawn.push(chosen)
  }
  return drawn
}

async function actionsOf(record: PerspectiveRecord): Promise<Actions> {
  const actions = (await import(join(record.dir, 'actions.ts'))).default as Actions
  if (actions?.facet !== record.facet) {
    throw new Error(`${record.slug}: its actions turn ${actions?.facet}, its record says ${record.facet}`)
  }
  return actions
}

function promptsOf(record: PerspectiveRecord): string[] {
  const file = join(record.dir, 'prompts.json')
  if (!existsSync(file)) return []
  const prompts = JSON.parse(readFileSync(file, 'utf8'))
  if (!Array.isArray(prompts) || !prompts.every((p) => typeof p === 'string')) {
    throw new Error(`${record.slug}: prompts.json is a list of words for a model`)
  }
  return prompts
}

/** Lets each drawn Perspective turn its Facet, from the defaults. */
export async function resolve(
  drawn: readonly PerspectiveRecord[],
  song: string,
  choirSize: number,
): Promise<{ perspectives: Chosen[]; settings: Settings }> {
  const settings = defaults(choirSize)
  const perspectives: Chosen[] = []
  for (const record of drawn) {
    const { facet, turn } = await actionsOf(record)
    const turned = turn(settings[facet] as never, {
      random: wrongness(`perspective:${record.slug}:${song}`),
      prompts: promptsOf(record),
    })
    ;(settings as Record<Facet, unknown>)[facet] = turned.setting
    perspectives.push({
      slug: record.slug,
      title: record.title,
      facet,
      ...(turned.variant ? { variant: turned.variant } : {}),
    })
  }
  return { perspectives, settings }
}

/**
 * A Song's Perspectives and the Settings they make, from its number. `only`
 * names the Perspectives to hear it from instead of drawing them, drafts
 * too: how a rehearsal hears a Perspective before it is made active.
 */
export async function perspectivesFor(
  song: string,
  {
    count,
    choirSize,
    only,
    home = perspectivesHome,
  }: { count: number; choirSize: number; only?: readonly string[]; home?: string },
) {
  const records = readPerspectives(home)
  if (!only) return resolve(draw(records, song, count), song, choirSize)
  const named = only.map((slug) => {
    const record = records.find((r) => r.slug === slug)
    if (!record) throw new Error(`there is no Perspective ${slug}`)
    return record
  })
  if (new Set(named.map((r) => r.facet)).size < named.length) {
    throw new Error('a Song is heard from only one Perspective on each Facet')
  }
  return resolve(named, song, choirSize)
}

/** How a Song's Perspectives read, for anyone watching, after the word "heard". */
export function describePerspectives(perspectives: readonly Chosen[]): string {
  return perspectives.length === 0
    ? 'plainly'
    : perspectives.map(({ title, variant }) => (variant ? `${title}: ${variant}` : title)).join(', ')
}
