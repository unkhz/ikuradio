// The composer writes one iteration at a time, always from the one before.
//
// A Song is a run of iterations in the same Mood. When a new Song begins,
// the Mood drifts: one description lets go, and the song chooses the one
// that arrives, from the last words it sang. A new choir is gathered to sing
// it, and the verses of the tune take one small step. Within a Song, the
// tune's Variations take turns. Everything else the composer needs, it reads
// from the last page of the diary.
//
// A Song lasts as long as its Arrangement says: its turns and one, two for the Song as it always was. The wrongness that
// once made some Songs longer than others now chooses its Perspectives: a
// few ways the Song is heard differently from the usual, drawn when it
// begins, before its weather drifts, and kept in the diary with it. Their
// Settings are what the Studio's hooks follow for the whole Song.

import { firstMood, nextMood, type Mood } from 'mood'
import { fieldsOf, iterationsOf, tempoOf, type Arrangement } from 'parts'
import { firstLyrics, forgotten, longWear, versesOf, wordinessWords, wordyCount, wornDeep, writeLyrics, type Fitting, type Lyrics, type Memories } from 'song'
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
import { applyTides, positionOf, readTides, type TideReading } from 'tides'
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
  /** What the Studio's hooks follow for this iteration: the defaults, moved by the Tides, as the Song's Perspectives turned them. */
  settings: Settings
  /** Where each Tide stood for this iteration. */
  tides?: TideReading[]
  /** How many syllables a second its voices may sing at most. */
  rate: number
}

/** The Arrangement a new Song takes, and how many iterations it makes: its turns and one. */
export type Take = { id: string; iterations: number }

/** The Arrangement a Song is made as when its page does not say: the Song as it always was. */
export const songAsItAlwaysWas = 'the-song'

/** What a Song that begins takes: one fixed Take, or a chooser asked for the new Song's number. */
export type TakeSource = Take | ((song: bigint) => Take)

export type ComposerOptions = {
  /** What a Song that begins now is made as: the Arrangement it takes, and so how many iterations it lasts. */
  take: TakeSource
  /** Looks up an Arrangement by id so per-region parameters and tempi can shape lyric fitting. */
  arrangementOf?: (id: string) => Promise<Arrangement> | Arrangement
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
 * Where an iteration stands among the Songs, from the page before it. A Song goes on as it began: its Arrangement and its length are the page's, kept until it
 * ends, whatever the Studio is asked to take now. A new Song takes `take`: the Arrangement chosen, and its turns and one for its length. Pages written before
 * Songs had their own lengths are read as they were then: every Song `take.iterations` long, counted from the very first iteration, made as the Song as it always was.
 */
export function placeOf(
  iteration: bigint,
  last: Page | undefined,
  take: TakeSource,
): { beginsSong: boolean; number: bigint; began: bigint; lasts: number; arrangement: string } {
  const resolveTake = (number: bigint) => (typeof take === 'function' ? take(number) : take)
  const begins = (number: bigint) => {
    const picked = resolveTake(number)
    return { beginsSong: true, number, began: iteration, lasts: Math.max(1, picked.iterations), arrangement: picked.id }
  }
  // the song counts from one: its first Song is Song 1
  if (!last) return begins(1n)
  const before: SongPlace =
    last.song ??
    (() => {
      const length = BigInt(Math.max(1, resolveTake(1n).iterations))
      return {
        number: `${BigInt(last.iteration) / length}`,
        began: `${BigInt(last.iteration) - (BigInt(last.iteration) % length)}`,
        lasts: Number(length),
      }
    })()
  const began = BigInt(before.began)
  if (iteration - began < BigInt(before.lasts)) {
    return { beginsSong: false, number: BigInt(before.number), began, lasts: before.lasts, arrangement: before.arrangement ?? songAsItAlwaysWas }
  }
  return begins(BigInt(before.number) + 1n)
}

/** Per-field wordiness and tempo overrides read from an Arrangement's regions in one pass. */
export type FieldOverride = { wordiness?: number; tempo?: number }

/**
 * Extracts per-field overrides from an Arrangement for a single pass: the first explicit `wordiness` on an instance mapping to that Lyrics field, and the fastest
 * numeric tempo under which that field is sung (so fitted words fit every hearing of the field).
 */
export function fieldOverrides(arrangement: Arrangement, pass: number, moodTempo: number): Partial<Record<keyof Lyrics, FieldOverride>> {
  const passOf = iterationsOf(arrangement.instances, arrangement.turns)
  const fields = fieldsOf(arrangement.instances)
  const tempi = tempoOf(arrangement.instances, arrangement.tempo)
  const found: Partial<Record<keyof Lyrics, FieldOverride>> = {}
  for (const [i, instance] of arrangement.instances.entries()) {
    if (passOf[i] !== pass) continue
    const field = fields[i]
    if (!field) continue
    const current = (found[field] ??= {})
    const w = instance.parameters?.wordiness
    if (w !== undefined && current.wordiness === undefined) current.wordiness = w
    const raw = tempi[i]
    const bpm = raw === 'mood' ? moodTempo : raw
    if (typeof bpm === 'number' && (current.tempo === undefined || bpm > current.tempo)) current.tempo = bpm
  }
  // drop entries that neither override wordiness nor differ from moodTempo
  for (const field of Object.keys(found) as (keyof Lyrics)[]) {
    const entry = found[field]!
    if (entry.tempo === moodTempo) delete entry.tempo
    if (entry.wordiness === undefined && entry.tempo === undefined) delete found[field]
  }
  return found
}

/**
 * What a line of the song is written to, at this tempo and rate: each
 * line's count, from the tune it will be sung to, and the check of how a
 * written line fits its bars, by its syllables and their stress as the
 * throat counts them.
 */
export function fittingFor(
  sung: Tune,
  tempo: number,
  rate: number,
  lyrics: Settings['lyrics'] = defaults(1).lyrics,
  overrides?: Partial<Record<keyof Lyrics, FieldOverride>>,
): Fitting {
  const phraseOf = (part: 'verse' | 'chorus', line: number) => (part === 'chorus' ? sung.chorus : sung.verse)[line % 4]!
  const checkAt = (part: 'verse' | 'chorus', bpm: number) => {
    const k = spacing(bpm, rate)
    return async (line: number, text: string): Promise<'fits' | 'grace' | 'refused'> => {
      const syllables = await countSyllables(text).catch(() => 0)
      if (syllables < 1) return 'refused'
      const phrase = phraseOf(part, line)
      const words = await stressedLine(text, syllables)
      // a line whose stress cannot be read is counted only
      if (!words) return syllables <= mostSyllables(phrase, k) ? 'fits' : 'refused'
      const fit = fitToCount(phrase, words, k)
      return !fit ? 'refused' : fit.grown ? 'grace' : 'fits'
    }
  }
  const countsFor = (part: 'verse' | 'chorus', bpm: number, wordiness: number) => {
    const k = spacing(bpm, rate)
    const phrases = part === 'chorus' ? sung.chorus : sung.verse
    return phrases.map((phrase, line) => {
      const count = { target: phrase.notes.length, most: mostSyllables(phrase, k) }
      // the chorus's first line, the number, is never touched by wordiness
      return part === 'chorus' && line === 0 ? count : wordyCount(count, wordiness)
    })
  }
  const checkVerse = checkAt('verse', tempo)
  const checkChorus = checkAt('chorus', tempo)
  // how wordy each part's lines are told to be: the chorus's first line, the number, is never touched
  const say = {
    ...(wordinessWords(lyrics.verse.wordiness) ? { verse: wordinessWords(lyrics.verse.wordiness) } : {}),
    ...(wordinessWords(lyrics.chorus.wordiness) ? { chorus: wordinessWords(lyrics.chorus.wordiness) } : {}),
  }
  const fields: NonNullable<Fitting['fields']> = {}
  if (overrides) {
    for (const [field, override] of Object.entries(overrides) as [keyof Lyrics, FieldOverride | undefined][]) {
      if (!override) continue
      const part: 'verse' | 'chorus' = field === 'chorus' ? 'chorus' : 'verse'
      const bpm = override.tempo ?? tempo
      const wordiness = override.wordiness ?? lyrics[part].wordiness
      const note = wordinessWords(wordiness)
      fields[field] = {
        counts: countsFor(part, bpm, wordiness),
        ...(note ? { say: note } : {}),
        ...(bpm !== tempo ? { check: checkAt(part, bpm) } : {}),
      }
    }
  }
  return {
    verse: countsFor('verse', tempo, lyrics.verse.wordiness),
    chorus: countsFor('chorus', tempo, lyrics.chorus.wordiness),
    ...(Object.keys(say).length ? { say } : {}),
    ...(Object.keys(fields).length ? { fields } : {}),
    check: (part, line, text) => (part === 'chorus' ? checkChorus(line, text) : checkVerse(line, text)),
    measure: (text) => countSyllables(text),
  }
}

export async function composer(
  diary: Diary,
  {
    take,
    arrangementOf,
    moodCount,
    choirSize,
    variationCount,
    rate: rateNow,
    heardFrom,
    memories = forgotten,
  }: ComposerOptions,
) {
  let last: Page | undefined = await diary.lastPage()
  // the Tides, read once: what each moves, and its envelope
  const tides = await readTides()

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
    const place = placeOf(iteration, last, take)
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
    // the defaults, moved by every Tide to where it stands at this iteration, its Song's place and how far through it
    const tided = applyTides(defaults(choirSize), tides, positionOf(song, Number(iteration - place.began), place.lasts))
    let settings = tided.settings
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
          base: tided.settings,
          ...(heardFrom ? { only: heardFrom } : {}),
        }))
      } else {
        perspectives = last.perspectives ?? []
        // the Song's Perspectives turn again, on top of where the Tides stand now: the same Turns, a little further along
        settings = await perspectivesFor(song, { choirSize, base: tided.settings, only: perspectives.map(({ slug }) => slug) })
          .then((resolved) => resolved.settings)
          // a Perspective no longer there: the Song goes on as its first iteration was turned, the Tides moved along
          .catch(() => applyTides({ ...tided.settings, ...last!.settings }, tides, positionOf(song, Number(iteration - place.began), place.lasts)).settings)
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
      const arrangement = arrangementOf ? await arrangementOf(place.arrangement) : undefined
      const overrides = arrangement ? fieldOverrides(arrangement, Number(iteration - place.began), mood.character.tempo) : undefined
      const fitting = fittingFor(tuneSung(tune, choir, settings, mood, song, variation), mood.character.tempo, rate, settings.lyrics, overrides)
      lyrics = await writeLyrics(iteration, mood.descriptions, last.lyrics, memories, { deep, fitting })
    }
    const where: SongPlace = { number: song, began: `${place.began}`, lasts: place.lasts, arrangement: place.arrangement }
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
      tides: tided.readings,
      rate,
    }
  }

  return { wakesAt, compose }
}
