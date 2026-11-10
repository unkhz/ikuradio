// The composer writes one iteration at a time, always from the one before.
//
// A Song is a run of iterations in the same Mood. When a new Song begins,
// the Mood drifts: one description lets go, one arrives, and a new choir is
// gathered to sing it. Everything else the composer needs, it reads from the
// last page of the diary.

import { firstMood, nextMood, type Mood } from 'mood'
import { firstLyrics, writeLyrics, type Lyrics } from 'song'
import { firstChoir, gather, type Choir } from 'vocals'
import type { Diary, Page } from './diary.js'

export type Iteration = {
  iteration: bigint
  mood: Mood
  /** The voices singing this Song, the lead first. */
  choir: Choir
  /** True for the first iteration of a Song, when the Mood has just changed. */
  beginsSong: boolean
  lyrics: Lyrics
}

export type ComposerOptions = {
  /** How many iterations one Song lasts. */
  songLength: number
  /** How many descriptions a Mood blends. */
  moodCount: number
  /** How many voices a choir gathers. */
  choirSize: number
}

export async function composer(
  diary: Diary,
  { songLength, moodCount, choirSize }: ComposerOptions,
) {
  let last: Page | undefined = await diary.lastPage()

  /** Where the song wakes up: the iteration after the last one it wrote down. */
  const wakesAt = last ? BigInt(last.iteration) + 1n : 0n

  async function compose(iteration: bigint): Promise<Iteration> {
    const beginsSong = iteration % BigInt(songLength) === 0n
    let mood: Mood
    let choir: Choir
    let lyrics: Lyrics
    if (!last) {
      // the very first iteration there has ever been: everything as a human made it
      mood = firstMood
      choir = firstChoir.slice(0, choirSize)
      lyrics = firstLyrics
    } else {
      mood = beginsSong ? await nextMood(last.mood, moodCount) : last.mood
      // pages written before there was a choir are sung by the first choir
      const remembered = last.choir ?? firstChoir.slice(0, choirSize)
      choir = beginsSong ? gather(choirSize) : remembered
      lyrics = await writeLyrics(iteration, mood.descriptions, last.lyrics)
    }
    last = {
      iteration: iteration.toString(),
      mood,
      choir,
      lyrics,
      written: new Date().toISOString(),
    }
    await diary.write(last)
    return { iteration, mood, choir, beginsSong, lyrics }
  }

  return { wakesAt, compose }
}
