// Introducing Songs (plan "Intro with Rezzy"). An intro is made after its Song
// has aired, never while it is made: the intro is not needed until the Song is
// historical, and the live Song is always the latest. So a run looks, in the
// Archive, for Songs that have aired and have no intro, newest first, and makes
// their intros in the slack between Songs, while the Heart has no Studio to call.
// The oldest, which the Archive has held for days, are made the same way.

import type { ArchiveStore, Session } from 'archive'
import { type Dj } from 'dj'
import { factsInput, type Facts } from 'song'
import { declare, growIntro, introRecord, openingOf, type Opening } from './intro.js'
import type { Placed } from 'vocals'

/**
 * The Songs that have aired and have no intro, newest first. `keys` is what the
 * Archive keeps under `sessions/`; `playing` is the Song the Radio is playing,
 * the last that has gone live, and `has` the intros kept apart. The Songs made
 * while intros were still made with their Songs have theirs inside their
 * Session, which only the Session tells (see `introduce`).
 */
export function unintroduced(keys: readonly string[], playing: string): string[] {
  const named = (pattern: RegExp) => new Set(keys.flatMap((key) => (pattern.exec(key)?.[1] ? [pattern.exec(key)![1]!] : [])))
  const has = named(/^sessions\/intro-(\d+)\.json$/)
  return [...named(/^sessions\/(\d+)\.json$/)]
    .filter((song) => BigInt(song) <= BigInt(playing) && !has.has(song))
    .sort((a, b) => (BigInt(a) < BigInt(b) ? 1 : BigInt(a) > BigInt(b) ? -1 : 0))
}

/** What the mind knows of a Song, as its Session tells. */
export const factsOf = (session: Session): Facts => ({
  name: session.name ?? `Song ${session.song}`,
  weather: session.mood,
  ...(session.sound ? { sound: session.sound } : {}),
  mode: session.mode,
  tempo: session.tempo,
  ...(session.thought ? { thought: session.thought } : {}),
})

/** What making intros needs, given so that a test can stand in for the machine. */
export type Introducing = {
  store: Pick<ArchiveStore, 'session' | 'putRecording' | 'putDj' | 'putIntro'>
  dj: Dj
  mind: { wake(): Promise<boolean>; rest(): Promise<void> }
  band: { wake(): Promise<unknown>; rest(): Promise<unknown> }
  /** What the DJ says of a Song, and how many syllables it has; nothing if the mind has nothing sensible to say. */
  speak(facts: Facts, persona: string): Promise<{ text: string; syllables: number } | undefined>
  grow(opened: Opening): Promise<Placed>
  loudness(file: string): Promise<{ lufs: number; peak: number } | undefined>
  /** Whether a Studio is wanted, and this run should stop. */
  yields(): Promise<boolean>
  log(line: string): void
}

/** What a run did. */
export type Done = { made: string[]; failed: string[]; yielded: boolean }

/**
 * Makes the intros of the first `most` of `songs` that need one, in the order
 * given: a Song with an intro inside its Session, or none to lead into, is
 * passed over without counting. The mind writes what the
 * DJ says of each first, and rests; then the band is woken once and grows the
 * music of each, and rests; then each is put into the Archive, the DJ's words
 * first, and the intro itself last, so that no intro is found half made. The
 * Session of a Song is read, never written. A Song whose music cannot be grown
 * has no intro yet, and is tried again another time; a Song the mind has
 * nothing sensible to say of still has its music, and its DJ does not come out.
 */
export async function introduce(run: Introducing, songs: readonly string[], most = 3): Promise<Done> {
  const done: Done = { made: [], failed: [], yielded: false }
  const planned: { song: string; opened: Opening; speech?: { text: string; syllables: number } }[] = []

  // the words: the mind awake
  await run.mind.wake()
  try {
    for (const song of songs) {
      if (planned.length >= most) break
      if (await run.yields()) {
        done.yielded = true
        break
      }
      const session = await run.store.session(song).catch(() => undefined)
      if (session?.intro) continue
      const opened = session && openingOf(session)
      if (!session || !opened) {
        run.log(`Song ${song} has no first verse to lead into; it is left alone`)
        done.failed.push(song)
        continue
      }
      const speech = await run.speak(factsOf(session), run.dj.persona).catch((error: Error) => {
        run.log(`the mind wrote nothing for Song ${song}: ${error.message}`)
        return undefined
      })
      run.log(speech ? `Song ${song}: ${run.dj.title} will say (${speech.syllables} syllables): ${speech.text}` : `Song ${song}: ${run.dj.title} has nothing to say`)
      planned.push({ song, opened, ...(speech ? { speech } : {}) })
    }
  } finally {
    await run.mind.rest()
  }
  if (!planned.length) return done

  // the music: the band awake
  const grown: { song: string; bed: Placed; speech?: { text: string; syllables: number } }[] = []
  try {
    await run.band.wake()
  } catch (error) {
    run.log(`the band would not wake: ${(error as Error).message}`)
    done.failed.push(...planned.map(({ song }) => song))
    return done
  }
  try {
    for (const { song, opened, speech } of planned) {
      try {
        grown.push({ song, bed: await run.grow(opened), ...(speech ? { speech } : {}) })
      } catch (error) {
        run.log(`the intro of Song ${song} did not grow: ${(error as Error).message}`)
        done.failed.push(song)
      }
    }
  } finally {
    await run.band.rest()
  }

  // into the Archive
  for (const { song, bed, speech } of grown) {
    try {
      const id = await run.store.putRecording(bed.file)
      if (speech) await run.store.putDj(declare(run.dj, song, speech.text, speech.syllables))
      await run.store.putIntro(introRecord(song, id, bed, await run.loudness(bed.file)))
      done.made.push(song)
    } catch (error) {
      run.log(`the intro of Song ${song} could not be put in the Archive: ${(error as Error).message}`)
      done.failed.push(song)
    }
  }
  return done
}
