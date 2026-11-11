// The composer writes one iteration at a time, always from the one before.
//
// A Song is a run of iterations in the same Mood. When a new Song begins,
// the Mood drifts: one description lets go, and the song chooses the one
// that arrives, from the last words it sang. A new choir is gathered to sing
// it, and the verses of the tune take one small step. Within a Song, the
// tune's Variations take turns. Everything else the composer needs, it reads
// from the last page of the diary.
//
// A Song lasts as long as its weather holds. Each Song is given its length
// when it begins: around the length it is asked for, a little shorter or a
// little longer, decided by the wrongness of its Mood. The same weather
// would always hold for the same time.

import { firstMood, nextMood, type Mood } from 'mood'
import { firstLyrics, writeLyrics, type Lyrics } from 'song'
import { firstChoir, gather, type Choir } from 'vocals'
import { evolve, firstTune, variations, wrongness, type Tune } from 'melody'
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
}

export type ComposerOptions = {
  /** About how many iterations one Song lasts. Each Song lasts a little more or less. */
  songLength: number
  /** How many descriptions a Mood blends. */
  moodCount: number
  /** How many voices a choir gathers. */
  choirSize: number
  /** How many Variations of the tune take turns within a Song. */
  variationCount: number
  /** What the mind remembers at this sitting, to tell its story from in the verses. */
  memories?: readonly string[]
}

/**
 * How many iterations a Song in this weather lasts: the length asked for,
 * one shorter, or up to two longer, and never fewer than two.
 */
export function lastsFor(mood: Mood, songLength: number): number {
  const drift = Math.floor(wrongness(`lasts:${mood.descriptions.join('+')}`)() * 4) - 1
  return Math.max(2, songLength + drift)
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
  if (!last) return { beginsSong: true, number: 0n, began: iteration }
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
  { songLength, moodCount, choirSize, variationCount, memories = [] }: ComposerOptions,
) {
  let last: Page | undefined = await diary.lastPage()

  /** Where the song wakes up: the iteration after the last one it wrote down. */
  const wakesAt = last ? BigInt(last.iteration) + 1n : 0n

  async function compose(iteration: bigint): Promise<Iteration> {
    const place = placeOf(iteration, last, songLength)
    const { beginsSong } = place
    const song = `${place.number}`
    let mood: Mood
    let choir: Choir
    let tune: Tune
    let lyrics: Lyrics
    if (!last) {
      // the very first iteration there has ever been: everything as a human made it
      mood = firstMood
      choir = firstChoir.slice(0, choirSize)
      tune = firstTune
      lyrics = firstLyrics
    } else {
      // the last words sung shape the weather of the next Song
      const words = [last.lyrics.thirdVerse, last.lyrics.finalChorus].join('\n')
      mood = beginsSong
        ? await nextMood(last.mood, moodCount, { words })
        : last.mood
      // pages written before there was a choir are sung by the first choir
      const remembered = last.choir ?? firstChoir.slice(0, choirSize)
      // the Mood names who leads and how the choir breathes, if the mind heard it
      choir = beginsSong
        ? gather(choirSize, Math.random, mood.character.voice)
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
    const sung = variations(tune, variationCount, song)[variation]
    last = {
      iteration: iteration.toString(),
      mood,
      choir,
      tune,
      song: where,
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
    }
  }

  return { wakesAt, compose }
}
