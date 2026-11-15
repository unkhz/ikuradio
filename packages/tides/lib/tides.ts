// Tides (plan "Tides"): a sibling of the Perspectives. A Perspective turns a
// way of hearing on for one Song. A Tide moves one numeric setting of one
// Facet, in one part, slowly over many Songs, rising and falling by its
// envelope (./envelope.ts). Each lives in a folder of its own here: its
// arkku record (tide.md, its state) and its actions.ts, which says what it
// moves and how. The Settings a Song's hooks follow are the defaults, then
// every Tide's value at that moment, then the Song's Perspectives' Turns.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Settings } from 'perspectives'
import { readAt, type Envelope, type Phase } from './envelope.js'

/** The numeric settings a Tide may move, each in one part. */
export type Moves =
  | { facet: 'melody'; part: 'verse' | 'chorus' | 'bridge'; setting: 'ceiling' | 'span' | 'travel' }
  | { facet: 'lyrics'; part: 'verse' | 'chorus'; setting: 'wordiness' }

/** What an actions.ts exports: what the Tide moves, and its envelope. */
export type Tide = Envelope & { moves: Moves }

/** Writes a Tide's actions, typed. */
export const tide = (definition: Tide): Tide => definition

/** A Tide as its record and actions say it is. */
export type TideRecord = Tide & { slug: string; title: string; state: 'draft' | 'active' | 'retired'; dir: string }

/** Where a Tide stood for a Song's iteration, as the Session keeps it. */
export type TideReading = {
  slug: string
  facet: Moves['facet']
  part: Moves['part']
  setting: Moves['setting']
  value: number
  phase: Phase
  through: number
  cycle: number
  age: number
}

/** Where the Tides live: a folder each, beside this package's own code. */
export const tidesHome = fileURLToPath(new URL('../', import.meta.url))

/** A record's state, slug and title, from its frontmatter and heading. */
function parseRecord(text: string, dir: string) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) throw new Error(`${dir}: a Tide record begins with frontmatter`)
  const fields = Object.fromEntries(
    match[1]!.split('\n').flatMap((line) => {
      const at = line.indexOf(':')
      return at > 0 ? [[line.slice(0, at).trim(), line.slice(at + 1).trim()]] : []
    }),
  )
  const title = /^# (.+)$/m.exec(text.slice(match[0].length))?.[1]?.trim() ?? fields.slug
  return { slug: fields.slug as string, title: title as string, state: fields.state as TideRecord['state'] }
}

/** Whether an envelope is one: a range of ages, shares that add up to no more than a cycle. */
export function checkEnvelope(slug: string, { age, attack, hold, decay, min, max }: Envelope) {
  if (!(age[0] >= 1 && age[1] >= age[0])) throw new Error(`${slug}: an age is a range of Songs, the shortest first`)
  if ([attack, hold, decay].some((share) => share < 0) || attack + hold + decay > 1 + 1e-9) {
    throw new Error(`${slug}: attack, hold and decay are shares of a cycle, adding up to at most 1`)
  }
  if (![min, max].every(Number.isFinite)) throw new Error(`${slug}: min and max are numbers`)
}

/** Every Tide there is, in the order of their names; never two on one setting of one part. */
export async function readTides(home = tidesHome): Promise<TideRecord[]> {
  const found: TideRecord[] = []
  for (const entry of readdirSync(home, { withFileTypes: true })) {
    const dir = join(home, entry.name)
    if (!entry.isDirectory() || !existsSync(join(dir, 'tide.md'))) continue
    const record = parseRecord(readFileSync(join(dir, 'tide.md'), 'utf8'), dir)
    const definition = (await import(join(dir, 'actions.ts'))).default as Tide
    checkEnvelope(record.slug, definition)
    found.push({ ...definition, ...record, dir })
  }
  found.sort((a, b) => a.slug.localeCompare(b.slug))
  const active = found.filter((t) => t.state === 'active')
  for (const [i, t] of active.entries()) {
    const twin = active.slice(0, i).find((u) => u.moves.facet === t.moves.facet && u.moves.part === t.moves.part && u.moves.setting === t.moves.setting)
    if (twin) throw new Error(`${t.slug} and ${twin.slug} both move ${t.moves.facet}.${t.moves.setting} in the ${t.moves.part}: one Tide a setting a part`)
  }
  return found
}

/**
 * Where a Song's iteration stands, in Songs: its Song's number, and how far
 * through the Song it is, so a Tide moves a little within a Song too and
 * never jumps at a Song's edge.
 */
export const positionOf = (song: string | bigint, iteration: number, iterations: number) =>
  Number(song) + Math.max(0, iteration) / Math.max(1, iterations)

/** The Settings with every active Tide's value at `position`, and where each Tide stood. */
export function applyTides(settings: Settings, tides: readonly TideRecord[], position: number): { settings: Settings; readings: TideReading[] } {
  const next = structuredClone(settings)
  const readings: TideReading[] = []
  for (const t of tides) {
    if (t.state !== 'active') continue
    const reading = readAt(t.slug, t, position)
    const { facet, part, setting } = t.moves
    const value = Math.round(reading.value * 1000) / 1000
    ;((next[facet] as Record<string, Record<string, number>>)[part] ??= {})[setting] = value
    readings.push({ slug: t.slug, facet, part, setting, ...reading, value, through: Math.round(reading.through * 1000) / 1000 })
  }
  return { settings: next, readings }
}
