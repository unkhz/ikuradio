// The composer writes one iteration at a time, always from the one before.
//
// A Song is a run of iterations in the same Mood. When a new Song begins,
// the Mood drifts: one description lets go, one arrives. Everything else the
// composer needs, it reads from the last page of the diary.

import { firstMood, nextMood, type Mood } from 'mood'
import { firstLyrics, writeLyrics, type Lyrics } from 'song'
import type { Diary, Page } from './diary.js'

export type Iteration = {
  iteration: bigint
  mood: Mood
  /** True for the first iteration of a Song, when the Mood has just changed. */
  beginsSong: boolean
  lyrics: Lyrics
}

export type ComposerOptions = {
  /** How many iterations one Song lasts. */
  songLength: number
  /** How many descriptions a Mood blends. */
  moodCount: number
}

export async function composer(
  diary: Diary,
  { songLength, moodCount }: ComposerOptions,
) {
  let last: Page | undefined = await diary.lastPage()

  /** Where the song wakes up: the iteration after the last one it wrote down. */
  const wakesAt = last ? BigInt(last.iteration) + 1n : 0n

  async function compose(iteration: bigint): Promise<Iteration> {
    const beginsSong = iteration % BigInt(songLength) === 0n
    let mood: Mood
    let lyrics: Lyrics
    if (!last) {
      // the very first iteration there has ever been: everything as a human made it
      mood = firstMood
      lyrics = firstLyrics
    } else {
      mood = beginsSong ? await nextMood(last.mood, moodCount) : last.mood
      lyrics = await writeLyrics(iteration, mood.descriptions, last.lyrics)
    }
    last = {
      iteration: iteration.toString(),
      mood,
      lyrics,
      written: new Date().toISOString(),
    }
    await diary.write(last)
    return { iteration, mood, beginsSong, lyrics }
  }

  return { wakesAt, compose }
}
