// The composer writes one iteration at a time, always from the one before.
//
// A Song is a run of iterations in the same Mood. When a new Song begins,
// the Mood drifts: one description lets go, and the song chooses the one
// that arrives, from the last words it sang. A new choir is gathered to sing
// it, and the verses of the tune take one small step. Within a Song, the
// tune's Variations take turns. Everything else the composer needs, it reads
// from the last page of the diary.
//
// A Song lasts as long as it is asked to: two iterations. The wrongness that
// once made some Songs longer than others now chooses its Perspectives: a
// few ways the Song is heard differently from the usual, drawn when it
// begins, before its weather drifts, and kept in the diary with it. Their
// Settings are what the Studio's hooks follow for the whole Song.

import { firstMood, nextMood, type Mood } from 'mood'
import { firstLyrics, forgotten, writeLyrics, type Lyrics, type Memories } from 'song'
import { firstChoir, gather, type Choir } from 'vocals'
import { evolve, firstTune, variations, type Tune } from 'melody'
import { defaults, perspectivesFor, type Chosen, type Settings } from 'perspectives'
import type { Diary, Page, SongPlace } from './diary.js'

export type Iteration = {
  iteration: bigint
  mood: Mood
  /** The voices singing this Song, the lead first. */
  choir: Choir
  /** The Song's tune, as it is passed on to the next Song. */
  tune: Tune
  /** Which of the Song's Variations this iteration sings, from 0. */
  variation: number
  /** The tune this iteration sings: the Song's tune, or one of its Variations. */
  sung: Tune
  /** True for the first iteration of a Song, when the Mood has just changed. */
  beginsSong: boolean
  /** Which Song this is, where it began, and how long it lasts. */
  song: SongPlace
  lyrics: Lyrics
  /** The Perspectives the Song is heard from. */
  perspectives: Chosen[]
  /** What the Studio's hooks follow for this Song: the defaults, as its Perspectives turned them. */
  settings: Settings
}

export type ComposerOptions = {
  /** How many iterations one Song lasts. */
  songLength: number
  /** How many Perspectives a Song is heard from. */
  perspectiveCount?: number
  /**
   * For a rehearsal: the Perspectives every Song is heard from, by name,
   * drafts too, instead of drawing them.
   */
  heardFrom?: readonly string[]
  /** How many descriptions a Mood blends. */
  moodCount: number
  /** How many voices a choir gathers. */
  choirSize: number
  /** How many Variations of the tune take turns within a Song. */
  variationCount: number
  /** What the mind remembers at this sitting, its own and heard, to tell its story from in the verses. */
  memories?: Memories
}

/**
 * How many iterations a Song lasts: as many as asked, whatever its weather.
 * Songs once lasted longer or shorter by the wrongness of their Mood; that
 * wrongness now chooses the Song's Perspectives instead.
 */
export function lastsFor(_mood: Mood, songLength: number): number {
  return Math.max(1, songLength)
}

/**
 * Where an iteration stands among the Songs, from the page before it.
 * Pages written before Songs had their own lengths are read as they were
 * then: every Song `songLength` long, counted from the very first iteration.
 * `lasts` is decided only when a new Song begins, from its Mood.
 */
export function placeOf(
  iteration: bigint,
  last: Page | undefined,
  songLength: number,
): { beginsSong: boolean; number: bigint; began: bigint; lasts?: number } {
  // the song counts from one: its first Song is Song 1
  if (!last) return { beginsSong: true, number: 1n, began: iteration }
  const length = BigInt(songLength)
  const before: SongPlace = last.song ?? {
    number: `${BigInt(last.iteration) / length}`,
    began: `${BigInt(last.iteration) - (BigInt(last.iteration) % length)}`,
    lasts: songLength,
  }
  const began = BigInt(before.began)
  if (iteration - began < BigInt(before.lasts)) {
    return {
      beginsSong: false,
      number: BigInt(before.number),
      began,
      lasts: before.lasts,
    }
  }
  return { beginsSong: true, number: BigInt(before.number) + 1n, began: iteration }
}

export async function composer(
  diary: Diary,
  {
    songLength,
    moodCount,
    choirSize,
    variationCount,
    perspectiveCount = 0,
    heardFrom,
    memories = forgotten,
  }: ComposerOptions,
) {
  let last: Page | undefined = await diary.lastPage()

  /** Where the song wakes up: the iteration after the last one it wrote down. */
  const wakesAt = last ? BigInt(last.iteration) + 1n : 1n

  async function compose(iteration: bigint): Promise<Iteration> {
    const place = placeOf(iteration, last, songLength)
    const { beginsSong } = place
    const song = `${place.number}`
    let mood: Mood
    let choir: Choir
    let tune: Tune
    let lyrics: Lyrics
    let perspectives: Chosen[] = []
    let settings = defaults(choirSize)
    if (!last) {
      // the very first iteration there has ever been: everything as a human made it
      mood = firstMood
      choir = firstChoir.slice(0, choirSize)
      tune = firstTune
      lyrics = firstLyrics
    } else {
      // a new Song's Perspectives are drawn before anything else, since one may turn its weather
      if (beginsSong) {
        ;({ perspectives, settings } = await perspectivesFor(song, {
          count: perspectiveCount,
          choirSize,
          ...(heardFrom ? { only: heardFrom } : {}),
        }))
      } else {
        perspectives = last.perspectives ?? []
        settings = last.settings ?? settings
      }
      // the last words sung shape the weather of the next Song
      const words = [last.lyrics.thirdVerse, last.lyrics.finalChorus].join('\n')
      mood = beginsSong
        ? await nextMood(last.mood, moodCount, { words, letGo: settings.drift.letGo })
        : last.mood
      // pages written before there was a choir are sung by the first choir
      const remembered = last.choir ?? firstChoir.slice(0, choirSize)
      // the Mood names who leads and how the choir breathes, if the mind heard it
      choir = beginsSong
        ? gather(settings.choir.size, Math.random, mood.character.voice)
        : remembered
      // pages written before the tune could change remember the tune it was born with
      const known = last.tune ?? firstTune
      tune = beginsSong ? evolve(known, song) : known
      lyrics = await writeLyrics(iteration, mood.descriptions, last.lyrics, memories)
    }
    const lasts = place.lasts ?? lastsFor(mood, songLength)
    const where: SongPlace = { number: song, began: `${place.began}`, lasts }
    const variation =
      Number(iteration - place.began) % Math.max(1, variationCount)
    const sung = variations(tune, variationCount, song, settings.development)[variation]
    last = {
      iteration: iteration.toString(),
      mood,
      choir,
      tune,
      song: where,
      perspectives,
      settings,
      lyrics,
      written: new Date().toISOString(),
    }
    await diary.write(last)
    return {
      iteration,
      mood,
      choir,
      tune,
      variation,
      sung,
      beginsSong,
      song: where,
      lyrics,
      perspectives,
      settings,
    }
  }

  return { wakesAt, compose }
}
