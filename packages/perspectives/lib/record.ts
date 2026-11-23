// A Perspective's record as the editor works it (plan "Evolution of Song", step 14): the fields of its perspective.md, checked by the rules
// the package keeps (`parseRecord`'s, and the Turn's own Facet), and written as the file is written, so that a file made in the Composer and one
// written by hand are the same text. Its Turn is code (actions.ts) and is not edited here: the record says which Facet it is and how often it is drawn.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { facets, parts, type Actions } from './facets.js'
import { perspectivesHome } from './choose.js'

/** The states a record may be in. */
export const states = ['draft', 'active', 'retired'] as const

/** The Facets that keep a Setting for each part: a Perspective on one of them may say which. */
export const partFacets = ['progression', 'melody', 'lyrics'] as const

/** A Perspective's record: its stored fields, and its words, the file after its frontmatter, as they are. */
export type PerspectiveFile = { slug: string; id: number; facet: string; part?: string; weight: number; state: string; body: string }

/** The fields of a perspective.md, as its frontmatter and its body say them. */
export function fileOf(text: string): PerspectiveFile {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) throw new Error('a Perspective record begins with frontmatter')
  const fields = Object.fromEntries(
    match[1]!.split('\n').flatMap((line) => {
      const at = line.indexOf(':')
      return at > 0 ? [[line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^"(.*)"$/, '$1')]] : []
    }),
  )
  return {
    slug: fields.slug ?? '',
    id: Number(fields.id),
    facet: fields.facet ?? '',
    ...(fields.part ? { part: fields.part } : {}),
    weight: Number(fields.weight),
    state: fields.state ?? '',
    body: text.slice(match[0].length),
  }
}

/** The text of a perspective.md: its frontmatter in the order the files keep it, and its words as they are. */
export function formatPerspective(file: PerspectiveFile): string {
  const lines = [`facet: ${file.facet}`, ...(file.part ? [`part: ${file.part}`] : []), `weight: ${file.weight}`, `state: ${file.state}`, `id: ${file.id}`, 'kind: perspective', `slug: ${file.slug}`]
  return `---\n${lines.join('\n')}\n---\n${file.body}`
}

/**
 * The first thing wrong with a record, as "field: what is wrong", or nothing. A Perspective whose folder is in `home` must turn the Facet its record says;
 * one that has no folder yet is not refused for that: its Turn is code, and is written where the Perspectives are.
 */
export async function refusePerspective(file: PerspectiveFile, home = perspectivesHome): Promise<string | undefined> {
  if (typeof file !== 'object' || file === null) return 'a Perspective is a record'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(file.slug ?? '')) return 'slug: lowercase words and digits joined by hyphens'
  if (!Number.isInteger(file.id) || file.id < 1) return 'id: a whole number from 1'
  if (!(facets as readonly string[]).includes(file.facet)) return `facet: it is one of ${facets.join(', ')}`
  if (!Number.isInteger(file.weight) || file.weight < 1 || file.weight > 10) return 'weight: a whole number from 1 to 10'
  if (!(states as readonly string[]).includes(file.state)) return `state: it is one of ${states.join(', ')}`
  if (file.part !== undefined) {
    if (!(parts as readonly string[]).includes(file.part)) return `part: it is one of ${parts.join(', ')}`
    if (!(partFacets as readonly string[]).includes(file.facet)) return `part: the ${file.facet} Facet is not kept for each part`
  }
  if (typeof file.body !== 'string') return 'body: its words are text'
  const actions = join(home, file.slug, 'actions.ts')
  if (existsSync(actions)) {
    const turned = ((await import(actions)).default as Actions | undefined)?.facet
    if (turned !== file.facet) return `facet: its Turn, in actions.ts, turns ${turned}`
  }
  return undefined
}
