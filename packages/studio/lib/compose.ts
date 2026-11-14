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
import { firstLyrics, forgotten, longWear, versesOf, wornDeep, writeLyrics, type Fitting, type Lyrics, type Memories } from 'song'
import { countSyllables, firstChoir, gather, type Choir } from 'vocals'
import {
  evolve,
  firstTune,
  fitToCount,
  keyFor,
  mostSyllables,
  sidesOf,
  spacing,
  unfamiliarVerse,
  variations,
  vocalRange,
  wrongness,
  type Tune,
} from 'melody'
import { stressedLine } from './stressed.js'
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
  /** How many syllables a second its voices may sing at most. */
  rate: number
}

export type ComposerOptions = {
  /** How many iterations one Song lasts. */
  songLength: number
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
  /** How many syllables a second a voice may sing at most, for every Song that begins from now on. */
  rate: number
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

/**
 * What a line of the song is written to, at this tempo and rate: each
 * line's count, from the tune it will be sung to, and the check of how a
 * written line fits its bars, by its syllables and their stress as the
 * throat counts them.
 */
export function fittingFor(sung: Tune, tempo: number, rate: number): Fitting {
  const k = spacing(tempo, rate)
  const phraseOf = (part: 'verse' | 'chorus', line: number) => (part === 'chorus' ? sung.chorus : sung.verse)[line % 4]!
  const countOf = (phrase: Tune['verse'][number]) => ({ target: phrase.notes.length, most: mostSyllables(phrase, k) })
  return {
    verse: sung.verse.map(countOf),
    chorus: sung.chorus.map(countOf),
    check: async (part, line, text) => {
      const syllables = await countSyllables(text).catch(() => 0)
      if (syllables < 1) return 'refused'
      const phrase = phraseOf(part, line)
      const words = await stressedLine(text, syllables)
      // a line whose stress cannot be read is counted only
      if (!words) return syllables <= mostSyllables(phrase, k) ? 'fits' : 'refused'
      const fit = fitToCount(phrase, words, k)
      return !fit ? 'refused' : fit.grown ? 'grace' : 'fits'
    },
  }
}

export async function composer(
  diary: Diary,
  {
    songLength,
    moodCount,
    choirSize,
    variationCount,
    rate: rateNow,
    heardFrom,
    memories = forgotten,
  }: ComposerOptions,
) {
  let last: Page | undefined = await diary.lastPage()

  /** Where the song wakes up: the iteration after the last one it wrote down. */
  const wakesAt = last ? BigInt(last.iteration) + 1n : 1n

  /** The tune an iteration sings: its Variation, of the verse the Song plays, which may be written for it alone. */
  const tuneSung = (tune: Tune, choir: Choir, settings: Settings, mood: Mood, song: string, variation: number): Tune => {
    // in a Song heard that way, its verse is played to a melody written for it alone;
    // the tune it remembers, and passes on to the next Song, is the one it had
    const [lead] = choir
    const played: Tune = settings['verse-tune'].unfamiliar
      ? {
          ...tune,
          verse: unfamiliarVerse(tune.verse, {
            key: keyFor(lead!.body, mood.character.mode),
            range: vocalRange[lead!.body],
            random: wrongness(`unfamiliar:${song}`),
          }),
        }
      : tune
    return variations(played, variationCount, song, settings.development)[variation]!
  }

  async function compose(iteration: bigint): Promise<Iteration> {
    const place = placeOf(iteration, last, songLength)
    // which of the Song's Variations this iteration sings, and how fast its voices may sing
    const variation = Number(iteration - place.began) % Math.max(1, variationCount)
    const rate = place.beginsSong || !last?.rate ? rateNow : last.rate
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
          choirSize,
          ...(heardFrom ? { only: heardFrom } : {}),
        }))
      } else {
        perspectives = last.perspectives ?? []
        // pages written before a Facet had a hook have no Setting for it, and follow its default
        settings = { ...settings, ...last.settings }
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
        ? gather(settings.choir.size, Math.random, mood.character.voice, {
            high: sidesOf(settings.harmony.placement, settings.choir.size - 1).map((side) => side === 'above'),
          })
        : remembered
      // pages written before the tune could change remember the tune it was born with
      const known = last.tune ?? firstTune
      tune = beginsSong ? evolve(known, song) : known
      // the words the song has leaned on for a day or so rest, until they are not worn so deep
      const deep = wornDeep(
        (await diary.recent({ count: longWear, before: iteration })).map(({ lyrics }) => versesOf(lyrics)),
        mood.descriptions,
      )
      if (deep.length) console.log(`iteration ${iteration} lets rest the words worn deep: ${deep.join(', ')}`)
      // the words are written to the tune they will be sung to, each line to its count
      const fitting = fittingFor(tuneSung(tune, choir, settings, mood, song, variation), mood.character.tempo, rate)
      lyrics = await writeLyrics(iteration, mood.descriptions, last.lyrics, memories, { deep, fitting })
    }
    const lasts = place.lasts ?? lastsFor(mood, songLength)
    const where: SongPlace = { number: song, began: `${place.began}`, lasts }
    const sung = tuneSung(tune, choir, settings, mood, song, variation)
    last = {
      iteration: iteration.toString(),
      mood,
      choir,
      tune,
      song: where,
      perspectives,
      settings,
      rate,
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
      rate,
    }
  }

  return { wakesAt, compose }
}
