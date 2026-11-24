// The Arrangement a Song is made as (plan "The Studio on timelines", step 3). It is chosen when the Song begins (`ARRANGEMENT`, the Song as it always was by default),
// kept in the diary until the Song ends, and decides how long the Song lasts: its turns and one. The Studio refuses one it cannot make, plainly, before the mind is
// woken: one that does not pass the parts package's own checks, one with a name the Song as it always was does not have (a name's words are that Song's, by name),
// and one that needs what the Studio has not yet been given.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { wrongness } from 'melody'
import { arrangementsHome, boundaryOf, iterationsOf, parseRecord, readArrangements, readParts, readTracks, refuseArrangement, tempoOf, type Arrangement } from 'parts'
import { songAsItAlwaysWas, type Take } from './compose.js'

/** What the Session can say of a part's type: a verse, a chorus or a bridge. */
const typesOfSession = ['verse', 'chorus', 'bridge']

/** How many iterations an Arrangement makes: its turns and one. */
export const iterationsOfArrangement = (arrangement: Pick<Arrangement, 'instances' | 'turns'>) => Math.max(...iterationsOf(arrangement.instances, arrangement.turns)) + 1

/**
 * The first thing an Arrangement asks that this Studio cannot yet make, said plainly, or nothing. `reference` is the Song as it always was: a name it does not have
 * has no words here. Parts other than verse, chorus or bridge, two bridges in a row, and any Block key placed under two different tempi are refused.
 */
export function unmet(arrangement: Arrangement, reference: Arrangement): string | undefined {
  const known = new Set(reference.instances.map(({ name }) => name))
  for (const { name } of arrangement.instances) if (!known.has(name)) return `it has the name "${name}", which ${reference.id} does not have: a name's words are ${reference.id}'s, by name, until an Arrangement may give a new name words of its own`
  for (const { name, part } of arrangement.instances) {
    if (!typesOfSession.includes(part)) return `its region "${name}" is a ${part}, and a Session can say only a verse, a chorus or a bridge`
  }
  // a key is one recording, made at one tempo: refuse a key whose placings lie under different tempi (plan "The Studio on timelines", step 6)
  const tempi = tempoOf(arrangement.instances, arrangement.tempo)
  const keyTempo = new Map<string, number | 'mood' | null>()
  const describeTempo = (t: number | 'mood' | null) => (t === null ? 'free time' : t === 'mood' ? 'the Mood tempo' : `${t} bpm`)
  for (const block of arrangement.blocks ?? []) {
    const start = boundaryOf(arrangement.instances, block.from)
    if (!start) continue
    const idx = Math.min(arrangement.instances.length - 1, Math.max(0, start.boundary))
    const here = tempi[idx]!
    const id = `${block.track}\u0000${block.key}`
    const seen = keyTempo.get(id)
    if (seen !== undefined && seen !== here) {
      return `its block "${block.key}" is placed under two tempi (${describeTempo(seen)} and ${describeTempo(here)}): one key is one recording, at one tempo`
    }
    keyTempo.set(id, here)
  }
  // the Studio hums a guide for a section by its place among the sections it sang, and a section is a region: two bridges in a row would be sung as one section
  for (let i = 1; i < arrangement.instances.length; i++) {
    const [before, here] = [arrangement.instances[i - 1]!, arrangement.instances[i]!]
    if (before.part === 'bridge' && here.part === 'bridge') return `its regions "${before.name}" and "${here.name}" are two bridges in a row, which are sung as one section`
  }
  return undefined
}

export type Chosen = { arrangement: Arrangement; iterations: number }

export type Weighted = Chosen & { weight: number }

/** Reads an Arrangement by its name, as the Composer does, and refuses it if it is not one: not there, not active, or not passing the parts package's checks. */
async function read(id: string): Promise<Arrangement> {
  const dir = join(arrangementsHome, id)
  let record: { state: string }
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
  return value as Arrangement
}

/**
 * The Arrangement a Song is made as, by its name: read, checked and found makeable, or refused with the reason. It is asked before the mind is woken, for the one a Song
 * that begins would take and for the one a Song in the middle was begun as.
 */
export async function chosen(id: string): Promise<Chosen> {
  const arrangement = await read(id)
  const reference = id === songAsItAlwaysWas ? arrangement : await read(songAsItAlwaysWas)
  const reason = unmet(arrangement, reference)
  if (reason) throw new Error(`the Arrangement "${id}" cannot be made yet: ${reason}`)
  return { arrangement, iterations: iterationsOfArrangement(arrangement) }
}

/** Every active, makeable Arrangement with a positive weight, ready to be drawn for new Songs. */
export async function poolOf(home = arrangementsHome): Promise<Weighted[]> {
  const all = await readArrangements(await readParts(), home, await readTracks())
  const reference = all.find(({ arrangement }) => arrangement.id === songAsItAlwaysWas)?.arrangement ?? (await read(songAsItAlwaysWas))
  const pool: Weighted[] = []
  for (const { arrangement, state, weight } of all) {
    if (state !== 'active' || weight <= 0) continue
    if (unmet(arrangement, reference)) continue
    pool.push({ arrangement, iterations: iterationsOfArrangement(arrangement), weight })
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
    if (roll < 0) return { arrangement: one.arrangement, iterations: one.iterations }
  }
  const last = active.at(-1)!
  return { arrangement: last.arrangement, iterations: last.iterations }
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
