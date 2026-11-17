// Naming the kept. When Songs got their names, every Song the Archive
// already holds was named as well, before Songs were ever linked by their
// numbers alone: each name from the words of its first iteration and the
// weather it is sung in, the way a new Song is named. It is run on the
// Studio's machine, against the Archive the Studio publishes to.

import { slugOf, type ArchiveStore, type Session } from 'archive'
import { nameSong } from 'song'

/** The words a Song was named by: the words of its first iteration. */
export function wordsOf(session: Session): string {
  const [first] = session.iterations
  if (!first) return ''
  return first.parts
    .flatMap(({ lines }) => lines.map(({ text }) => text))
    .filter(Boolean)
    .join('\n')
}

/**
 * Names every Song the Archive holds that has no name, one at a time, in
 * order. The names already given are worn, and are told to the mind, so
 * that it does not give one of them again. A name that does not come is
 * left for now, and is told, so that the run's pace is heard; and when no
 * name comes for three Songs in a row, the run stops, so that it may be
 * made again when names come. Returns how many Songs were named, and the
 * numbers of the Songs still without a name.
 */
export async function nameKept(
  store: ArchiveStore,
  { quiet = false, name: ask = nameSong }: { quiet?: boolean; name?: typeof nameSong } = {},
): Promise<{ named: number; unmarked: string[] }> {
  const { songs } = await store.index()
  const worn = await store.names()
  const kept = new Map<string, Session>()
  for (const song of songs) {
    const session = await store.session(song)
    if (session) kept.set(song, session)
  }
  // the names already given: the mind does not give one of them again
  const given = [...kept.values()].filter(({ name }) => name).map(({ name }) => name!)
  let named = 0
  let starved = 0
  const unmarked: string[] = []
  for (const song of songs) {
    const session = kept.get(song)
    if (!session || session.name) continue
    const name = await ask(wordsOf(session), session.mood, worn, given)
    if (!name) {
      unmarked.push(song)
      starved++
      if (starved < 3) {
        if (!quiet) console.warn(`Song ${song} is not named yet`)
        continue
      }
      throw new Error('no name comes for three Songs in a row; this run stops, and may be made again')
    }
    starved = 0
    session.name = name
    await store.putSession(session)
    worn[slugOf(name)] = song
    given.push(name)
    named++
    if (!quiet) console.log(`Song ${song} is named: ${name}`)
  }
  return { named, unmarked }
}

/**
 * Verifies that every Song the Archive holds has a name, and that the
 * name's slug is worn by that Song and no other: the check made before
 * Songs are ever linked by their numbers alone. Returns the numbers of
 * the Songs still without a name, and of the Songs whose names are worn
 * by another.
 */
export async function verifyNamed(store: ArchiveStore): Promise<{ unmarked: string[]; mismatched: string[] }> {
  const { songs } = await store.index()
  const worn = await store.names()
  const unmarked: string[] = []
  const mismatched: string[] = []
  for (const song of songs) {
    const session = await store.session(song)
    if (!session) continue
    if (!session.name) {
      unmarked.push(song)
      continue
    }
    if (worn[slugOf(session.name)] !== song) mismatched.push(song)
  }
  return { unmarked, mismatched }
}
