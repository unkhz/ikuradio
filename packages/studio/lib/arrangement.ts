// The Arrangement a Song is made as (plan "The Studio on timelines", step 3). It is chosen when the Song begins (`ARRANGEMENT`, the Song as it always was by default),
// kept in the diary until the Song ends, and decides how long the Song lasts: its turns and one. The Studio refuses one it cannot make, plainly, before the mind is
// woken: one that does not pass the parts package's own checks, one with a name the Song as it always was does not have (a name's words are that Song's, by name),
// and one that needs what the Studio has not yet been given.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { wrongness } from 'melody'
import { arrangementsHome, boundaryOf, iterationsOf, parseRecord, readArrangements, readParts, readTracks, refuseArrangement, tempoOf, type Arrangement } from 'parts'
import { songAsItAlwaysWas, type Take } from './compose.js'

/** Tracks the Studio knows how to realize. */
const supportedTracks = new Set(['voice', 'bed', 'guide', 'drone', 'pulse'])

/** How many iterations an Arrangement makes: its turns and one. */
export const iterationsOfArrangement = (arrangement: Pick<Arrangement, 'instances' | 'turns'>) => Math.max(...iterationsOf(arrangement.instances, arrangement.turns)) + 1

/**
 * The first thing an Arrangement asks that this Studio cannot yet make, said plainly, or nothing.
 * Checks that every part is active (when `activeParts` is given), every block track is supported,
 * and no single recording key (`voice`, `bed`, `guide`, `pulse`) is placed under two different tempi.
 */
export function unmet(
  arrangement: Arrangement,
  _reference?: Arrangement,
  activeParts?: ReadonlySet<string>,
): string | undefined {
  if (activeParts) {
    for (const { name, part } of arrangement.instances) {
      if (!activeParts.has(part)) return `its region "${name}" is a ${part}, which is not among the active parts`
    }
  }
  for (const track of arrangement.tracks ?? []) {
    if (!supportedTracks.has(track)) return `it lists track "${track}", which this Studio cannot make yet`
  }
  // a key is one recording, made at one tempo and within one iteration: refuse keys placed under two tempi or across two iterations
  const tempi = tempoOf(arrangement.instances, arrangement.tempo)
  const passes = iterationsOf(arrangement.instances, arrangement.turns)
  const keyTempo = new Map<string, number | 'mood' | null>()
  const keyPass = new Map<string, number>()
  const describeTempo = (t: number | 'mood' | null) => (t === null ? 'free time' : t === 'mood' ? 'the Mood tempo' : `${t} bpm`)
  for (const block of arrangement.blocks ?? []) {
    if (!supportedTracks.has(block.track)) return `its block "${block.key}" is on track "${block.track}", which this Studio cannot make yet`
    const start = boundaryOf(arrangement.instances, block.from)
    if (!start) continue
    const idx = Math.min(arrangement.instances.length - 1, Math.max(0, start.boundary))
    const id = `${block.track}\u0000${block.key}`
    if (block.track === 'voice' || block.track === 'bed' || block.track === 'guide') {
      const passHere = passes[idx]!
      const prevPass = keyPass.get(id)
      if (prevPass !== undefined && prevPass !== passHere) {
        return `its block "${block.key}" is placed across two iterations: each iteration names its own keys`
      }
      keyPass.set(id, passHere)
    }
    if (block.track === 'drone') continue
    const here = tempi[idx]!
    const seen = keyTempo.get(id)
    if (seen !== undefined && seen !== here) {
      return `its block "${block.key}" is placed under two tempi (${describeTempo(seen)} and ${describeTempo(here)}): one key is one recording, at one tempo`
    }
    keyTempo.set(id, here)
  }
  return undefined
}

export type Chosen = { arrangement: Arrangement; title: string; iterations: number }

export type Weighted = Chosen & { weight: number }

/** Reads an Arrangement by its name, as the Composer does, and refuses it if it is not one: not there, not active, or not passing the parts package's checks. */
async function read(id: string): Promise<{ arrangement: Arrangement; title: string }> {
  const dir = join(arrangementsHome, id)
  let record: { state: string; title: string }
  let value: unknown
  try {
    record = parseRecord(await readFile(join(dir, 'arrangement.md'), 'utf8'), dir, "an Arrangement's")
    value = JSON.parse(await readFile(join(dir, 'arrangement.json'), 'utf8'))
  } catch (error) {
    throw new Error(`the Arrangement "${id}" cannot be read: ${(error as Error).message}`)
  }
  if (record.state !== 'active') throw new Error(`the Arrangement "${id}" is ${record.state}, and only an active one is made`)
  const problem = refuseArrangement(value, await readParts(), await readTracks())
  if (problem) throw new Error(`the Arrangement "${id}" is refused: ${problem}`)
  return { arrangement: value as Arrangement, title: record.title }
}

/**
 * The Arrangement a Song is made as, by its name: read, checked and found makeable, or refused with the reason. It is asked before the mind is woken, for the one a Song
 * that begins would take and for the one a Song in the middle was begun as.
 */
export async function chosen(id: string): Promise<Chosen> {
  const { arrangement, title } = await read(id)
  const parts = await readParts()
  const activeParts = new Set(parts.filter(({ state }) => state === 'active').map(({ part }) => part.id))
  const reason = unmet(arrangement, undefined, activeParts)
  if (reason) throw new Error(`the Arrangement "${id}" cannot be made yet: ${reason}`)
  return { arrangement, title, iterations: iterationsOfArrangement(arrangement) }
}

/** Every active, makeable Arrangement with a positive weight, ready to be drawn for new Songs. */
export async function poolOf(home = arrangementsHome): Promise<Weighted[]> {
  const parts = await readParts()
  const activeParts = new Set(parts.filter(({ state }) => state === 'active').map(({ part }) => part.id))
  const all = await readArrangements(parts, home, await readTracks())
  const pool: Weighted[] = []
  for (const { arrangement, title, state, weight } of all) {
    if (state !== 'active' || weight <= 0) continue
    if (unmet(arrangement, undefined, activeParts)) continue
    pool.push({ arrangement, title, iterations: iterationsOfArrangement(arrangement), weight })
  }
  return pool
}

/**
 * Draws one Arrangement from `pool` by weight, deterministically from the Song's number so the same Song always takes the same Arrangement.
 * Refuses an empty pool plainly.
 */
export function drawFrom(pool: readonly Weighted[], song: string | bigint, random = wrongness(`arrangement:${song}`)): Chosen {
  const active = pool.filter(({ weight }) => weight > 0)
  if (active.length === 0) throw new Error('there is no active, makeable Arrangement with weight above 0 to draw from')
  const total = active.reduce((sum, { weight }) => sum + weight, 0)
  let roll = random() * total
  for (const one of active) {
    roll -= one.weight
    if (roll < 0) return { arrangement: one.arrangement, title: one.title, iterations: one.iterations }
  }
  const last = active.at(-1)!
  return { arrangement: last.arrangement, title: last.title, iterations: last.iterations }
}

/**
 * How the Studio chooses an Arrangement for each new Song: pinned to `pinned` when given (checked upfront), or drawn by weight across every active makeable
 * Arrangement otherwise. Checked before the mind is woken.
 */
export async function chooser(pinned?: string): Promise<{ take: (song: bigint) => Take; byId: (id: string) => Promise<Chosen>; summary: string }> {
  const cache = new Map<string, Chosen>()
  const byId = async (id: string) => {
    const cached = cache.get(id)
    if (cached) return cached
    const one = await chosen(id)
    cache.set(id, one)
    return one
  }
  if (pinned !== undefined) {
    const one = await byId(pinned)
    const take = takeOf(one)
    return {
      take: () => take,
      byId,
      summary: `the Arrangement "${take.id}", ${take.iterations} iteration${take.iterations > 1 ? 's' : ''} long`,
    }
  }
  const pool = await poolOf()
  if (pool.length === 0) throw new Error('there is no active, makeable Arrangement with weight above 0 to draw from')
  for (const one of pool) cache.set(one.arrangement.id, one)
  const total = pool.reduce((sum, { weight }) => sum + weight, 0)
  const parts = pool.map(({ arrangement, weight }) => `${arrangement.id} (${Math.round((weight / total) * 100)}%)`).join(', ')
  return {
    take: (song: bigint) => takeOf(drawFrom(pool, song)),
    byId,
    summary: pool.length === 1 ? `the Arrangement "${pool[0]!.arrangement.id}", ${pool[0]!.iterations} iteration${pool[0]!.iterations > 1 ? 's' : ''} long` : `drawn by weight: ${parts}`,
  }
}

/** What a Song that begins takes, from a chosen Arrangement. */
export const takeOf = ({ arrangement, iterations }: Chosen): Take => ({ id: arrangement.id, iterations })
