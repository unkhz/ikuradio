// Naming the kept. When Songs got their names, every Song the Archive
// already holds was named as well, before Songs were ever linked by their
// numbers alone: each name from the words of its first iteration and the
// weather it is sung in, the way a new Song is named. It is run on the
// Studio's machine, against the Archive the Studio publishes to.

import { slugOf, type ArchiveStore, type Session } from 'archive'
import { nameSong, Silence } from 'song'

/** The words a Song was named by: the words of its first iteration. */
export function wordsOf(session: Session): string {
  const [first] = session.iterations
  if (!first) return ''
  return first.parts
    .flatMap(({ lines }) => lines.map(({ text }) => text))
    .filter(Boolean)
    .join('\n')
}

/** The Archive, kept: every Song that is there, read eight at a time, as the Studio reads it. */
async function keptOf(store: ArchiveStore): Promise<{ songs: string[]; kept: Map<string, Session> }> {
  const { songs } = await store.index()
  const kept = new Map<string, Session>()
  for (let i = 0; i < songs.length; i += 8) {
    const batch = songs.slice(i, i + 8)
    const sessions = await Promise.all(batch.map((song) => store.session(song)))
    batch.forEach((song, j) => {
      const session = sessions[j]
      if (session) kept.set(song, session)
    })
  }
  return { songs, kept }
}

/**
 * The Archive, not yet named: the slugs already worn, and the Sessions of
 * the Songs that wear no slug, read eight at a time. A Song that wears a
 * slug is named, and is not read again: the naming asks the Archive for
 * every slug once, and for a Session only when it has no name to wear.
 */
async function unwornOf(store: ArchiveStore): Promise<{ worn: Record<string, string>; kept: Map<string, Session>; unworn: string[] }> {
  const { songs } = await store.index()
  const worn = await store.names()
  const wornSongs = new Set(Object.values(worn))
  const unworn = songs.filter((song) => !wornSongs.has(song))
  const kept = new Map<string, Session>()
  for (let i = 0; i < unworn.length; i += 8) {
    const batch = unworn.slice(i, i + 8)
    const sessions = await Promise.all(batch.map((song) => store.session(song)))
    batch.forEach((song, j) => {
      const session = sessions[j]
      if (session) kept.set(song, session)
    })
  }
  return { worn, kept, unworn }
}

/**
 * Names every Song the Archive holds that has no name, one at a time, in
 * order. A Song that wears a slug is named already, and is not read; the
 * names already given are worn, and are told to the mind, from the slugs
 * that wear them, so that it does not give one of them again. A name that
 * does not come is left for now, and is told, so that the run's pace is
 * heard: the mind answered, and only its answer was not a name, and the
 * run goes on. And when the mind falls silent for three Songs in a row,
 * the run stops, so that a sick mind costs minutes, not hours, and the run
 * may be made again when the mind wakes. Returns how many Songs were
 * named, the numbers of the Songs still without a name, and the numbers of
 * the Songs that are listed, and not there.
 */
export async function nameKept(
  store: ArchiveStore,
  { quiet = false, name: ask = nameSong }: { quiet?: boolean; name?: typeof nameSong } = {},
): Promise<{ named: number; unmarked: string[]; missing: string[] }> {
  const { worn, kept, unworn } = await unwornOf(store)
  // the names already given: the names of the Songs read, and the slugs of the rest,
  // which the Archive says are worn — the mind does not give one of them again
  const given = [
    ...kept.values().filter(({ name }) => name).map(({ name }) => name!),
    ...Object.keys(worn).map((slug) => slug.replaceAll('-', ' ')),
  ]
  let named = 0
  let starved = 0
  const unmarked: string[] = []
  const missing: string[] = []
  for (const song of unworn) {
    const session = kept.get(song)
    if (!session) {
      // listed in the index, wearing no slug, and not there to read: it cannot be named, and it is told
      missing.push(song)
      if (!quiet) console.warn(`Song ${song} is listed, and not there`)
      continue
    }
    if (session.name) continue
    let name: string | undefined
    try {
      name = await ask(wordsOf(session), session.mood, worn, given)
    } catch (error) {
      if (!(error instanceof Silence)) throw error
      starved++
      unmarked.push(song)
      if (!quiet) console.warn(`Song ${song}: the mind fell silent`)
      if (starved >= 3) {
        throw new Error(
          'the mind fell silent for three Songs in a row; this run stops, and may be made again when the mind wakes',
        )
      }
      continue
    }
    if (!name) {
      // the mind answered, and no answer was a name: the Song is left for now, and the run goes on
      unmarked.push(song)
      if (!quiet) console.warn(`Song ${song} is not named yet`)
      continue
    }
    starved = 0
    session.name = name
    await store.putSession(session)
    worn[slugOf(name)] = song
    given.push(name)
    named++
    if (!quiet) console.log(`Song ${song} is named: ${name}`)
  }
  return { named, unmarked, missing }
}

/**
 * Verifies that every Song the Archive holds has a name, and that the
 * name's slug is worn by that Song and no other: the check made before
 * Songs are ever linked by their numbers alone. Returns the numbers of
 * the Songs still without a name, and of the Songs whose names are worn
 * by another.
 */
export async function verifyNamed(store: ArchiveStore): Promise<{ unmarked: string[]; mismatched: string[] }> {
  const { songs, kept } = await keptOf(store)
  const worn = await store.names()
  const unmarked: string[] = []
  const mismatched: string[] = []
  for (const song of songs) {
    const session = kept.get(song)
    if (!session) {
      // listed in the index, and not there to read: the check cannot pass for it
      unmarked.push(song)
      continue
    }
    if (!session.name) {
      unmarked.push(song)
      continue
    }
    if (worn[slugOf(session.name)] !== song) mismatched.push(song)
  }
  return { unmarked, mismatched }
}
