// The Arrangement a Song is made as (plan "The Studio on timelines", step 3). It is chosen when the Song begins (`ARRANGEMENT`, the Song as it always was by default),
// kept in the diary until the Song ends, and decides how long the Song lasts: its turns and one. The Studio refuses one it cannot make, plainly, before the mind is
// woken: one that does not pass the parts package's own checks, one with a name the Song as it always was does not have (a name's words are that Song's, by name),
// and one that needs what the Studio has not yet been given.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { arrangementsHome, iterationsOf, parseRecord, readParts, readTracks, refuseArrangement, type Arrangement } from 'parts'
import { songAsItAlwaysWas, type Take } from './compose.js'

/** What the Session can say of a part's type: a verse, a chorus or a bridge. */
const typesOfSession = ['verse', 'chorus', 'bridge']

/** How many iterations an Arrangement makes: its turns and one. */
export const iterationsOfArrangement = (arrangement: Pick<Arrangement, 'instances' | 'turns'>) => Math.max(...iterationsOf(arrangement.instances, arrangement.turns)) + 1

/**
 * The first thing an Arrangement asks that this Studio cannot yet make, said plainly, or nothing. `reference` is the Song as it always was: a name it does not have
 * has no words here. What the Session has no field for yet (a tempo of a part's own, free time, a fade in, a part that is not a verse, a chorus or a bridge) is refused until
 * the Session has it, and the Studio makes each iteration as the Song as it always was until it is made from the timeline (step 4): regions in another order are refused.
 */
export function unmet(arrangement: Arrangement, reference: Arrangement): string | undefined {
  const known = new Set(reference.instances.map(({ name }) => name))
  for (const { name } of arrangement.instances) if (!known.has(name)) return `it has the name "${name}", which ${reference.id} does not have: a name's words are ${reference.id}'s, by name, until an Arrangement may give a new name words of its own`
  for (const { name, part, seconds } of arrangement.instances) {
    if (!typesOfSession.includes(part)) return `its region "${name}" is a ${part}, and a Session can say only a verse, a chorus or a bridge`
    if (seconds !== undefined) return `its region "${name}" is in free time, which a Session cannot yet say`
  }
  for (const point of arrangement.tempo ?? []) {
    if (point.region !== undefined || point.bpm !== 'mood') return 'it changes the tempo, and a Session has one tempo, the Mood\'s'
  }
  for (const block of arrangement.blocks ?? []) if (block.fadeIn) return `its block "${block.key}" fades in, which a Session cannot yet say`
  // every iteration is laid as the Song as it always was lays one, until the Studio makes the Song from the timeline
  const names = (list: readonly { name: string }[]) => list.map(({ name }) => name)
  const per = iterationsOf(arrangement.instances, arrangement.turns)
  const own = names(arrangement.instances)
  const referencePer = iterationsOf(reference.instances, reference.turns)
  const first = names(reference.instances).filter((_, i) => referencePer[i] === 0)
  const passes = Math.max(...per) + 1
  for (let pass = 0; pass < passes; pass++) {
    const these = own.filter((_, i) => per[i] === pass)
    if (JSON.stringify(these) !== JSON.stringify(first)) return `its iteration ${pass + 1} is not laid as ${reference.id} lays one, which is the only way the Studio can make one yet`
  }
  return undefined
}

export type Chosen = { arrangement: Arrangement; iterations: number }

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

/** What a Song that begins takes, from a chosen Arrangement. */
export const takeOf = ({ arrangement, iterations }: Chosen): Take => ({ id: arrangement.id, iterations })
