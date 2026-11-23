// The files of Perspectives and Tides, as the Composer checks, formats and previews them (plan "Evolution of Song", step 14): what the packages that own
// them say is wrong, said as the field it is about; the text of the files as the packages write them; and what an edit does, drawn from the same
// functions the Studio uses, never from rules repeated in a page. The server writes no file.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { clash, defaults, fileOf as perspectiveFileOf, formatPerspective, parseRecord, perspectivesHome, readPerspectives, refusePerspective, resolve, type PerspectiveFile, type PerspectiveRecord } from 'perspectives'
import { cycleAt, fileOf as tideFileOf, formatTideActions, formatTideRecord, readTides, refuseTide, validRange, valueAt, type TideFile, type TideRecord } from 'tides'

/** What a refusal in the form "field: words" is about, for the page to mark. */
export const fieldOf = (refusal: string): string | null => /^([a-z]+): /.exec(refusal)?.[1] ?? null

const isNode = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every leaf of a Settings tree, with its path. */
function leaves(value: unknown, path: string[] = []): { path: string[]; value: unknown }[] {
  return isNode(value) && Object.keys(value).length ? Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key])) : [{ path, value }]
}

/** The title of a record: its first heading, else its slug. */
const titleOf = (body: string, slug: string) => /^# (.+)$/m.exec(body)?.[1]?.trim() ?? slug

// ---- Perspectives

/** The record of every Perspective, as a draft to edit. */
export const perspectiveDrafts = (): PerspectiveFile[] => readPerspectives().map((record) => perspectiveFileOf(readFileSync(join(record.dir, 'perspective.md'), 'utf8')))

/** A Perspective's draft, checked; and what it would be heard as: how often it is drawn, what it clashes with, and the Settings its Turn makes with it and without. */
export async function perspectiveChecked(file: PerspectiveFile) {
  const refusal = await refusePerspective(file)
  if (refusal) return { refusal, field: fieldOf(refusal) }
  const home = perspectivesHome
  const others = readPerspectives(home).filter((record) => record.slug !== file.slug)
  const record: PerspectiveRecord = { slug: file.slug, title: titleOf(file.body, file.slug), facet: file.facet as PerspectiveRecord['facet'], weight: file.weight, state: file.state as PerspectiveRecord['state'], ...(file.part ? { part: file.part as PerspectiveRecord['part'] } : {}), dir: join(home, file.slug) }
  const active = [...others, record].filter((one) => one.state === 'active')
  const total = active.reduce((sum, one) => sum + one.weight, 0)
  // heard once, from the defaults, in a Song of the Composer's own: what its Turn makes, if it has one written
  let without: ReturnType<typeof leaves> = leaves(defaults(1))
  let withIt = without
  let turn = false
  try {
    const { settings } = await resolve([record], 'composer', 1)
    withIt = leaves(settings)
    turn = true
  } catch {
    // no Turn written for it yet: it turns nothing
  }
  const changed = withIt.flatMap((leaf) => {
    const before = without.find((one) => one.path.join('.') === leaf.path.join('.'))?.value
    return JSON.stringify(before) === JSON.stringify(leaf.value) ? [] : [{ path: leaf.path, without: before, with: leaf.value }]
  })
  return {
    ok: true as const,
    odds: { weight: file.weight, total, share: record.state === 'active' && total ? file.weight / total : 0, active: record.state === 'active' },
    clashes: others.filter((other) => other.state === 'active' && clash(record, other)).map((other) => ({ slug: other.slug, title: other.title })),
    turn,
    changed,
  }
}

export const perspectiveText = async (file: PerspectiveFile) => {
  const refusal = await refusePerspective(file)
  return refusal ? { refusal, field: fieldOf(refusal) } : { text: formatPerspective(file), files: [{ name: `${file.slug}.perspective.md`, text: formatPerspective(file) }] }
}

// ---- Tides

/** Every Tide, as a draft to edit. */
export async function tideDrafts(): Promise<TideFile[]> {
  return (await readTides()).map((record) => tideFileOf(readFileSync(join(record.dir, 'tide.md'), 'utf8'), record))
}

/** How many Songs each side of the Song the curve shows, and how many points a Song has. */
const reach = 18
const perSong = 4

/** A Tide's draft, checked; and its envelope as a curve around a Song, the cycles in that window, and where the Song stands. */
export async function tideChecked(file: TideFile, song: number) {
  const others: TideRecord[] = await readTides()
  const refusal = refuseTide(file, others)
  if (refusal) return { refusal, field: fieldOf(refusal) }
  const tide = { ...file, noise: file.noise ?? 0, grain: file.grain ?? 1 }
  const from = Math.max(0, song - reach)
  const to = song + reach
  const at = (position: number) => valueAt(tide, position)
  const now = at(song)
  const cycles: { begins: number; age: number }[] = []
  for (let position = from; position < to; ) {
    const cycle = cycleAt(file.slug, file.age, position)
    cycles.push({ begins: cycle.begins, age: cycle.age })
    position = cycle.begins + cycle.age
  }
  return {
    ok: true as const,
    song,
    window: [from, to],
    range: validRange[file.moves.setting],
    now: { value: now.value, phase: now.phase, through: now.through },
    cycles,
    curve: Array.from({ length: (to - from) * perSong + 1 }, (_, i) => {
      const position = from + i / perSong
      return [position, at(position).value]
    }),
  }
}

export async function tideTexts(file: TideFile) {
  const refusal = refuseTide(file, await readTides())
  return refusal ? { refusal, field: fieldOf(refusal) } : { files: [{ name: `${file.slug}.actions.ts`, text: formatTideActions(file) }, { name: `${file.slug}.tide.md`, text: formatTideRecord(file) }] }
}

export { parseRecord }
