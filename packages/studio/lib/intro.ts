// The intro (plan "Intro with Rezzy"): fifteen seconds before a Song, from
// nothing into its first verse, with a bed the band grows from them, and a
// DJ's speech to be said over them. It has no drums and no other rhythmic
// instrument, so it does not have to fit the Song's bars: its length is its
// own, and the same for every Song. It lies before the Song's moment 0, so
// nothing in the Song moves for it.
//
// An intro is made after its Song has aired, from the Song's Session alone:
// what it leads into is the first verse as it was sung, read from the lead's
// take. So any Song the Archive holds may be introduced, new or old.

import { holdLast, keyFor, nearestDegree, opening, vocalRange, type Key, type ModeName, type Phrase, type Score, type Singer } from 'melody'
import type { Mood } from 'mood'
import { accompany, tail, words } from 'music'
import { record, type Placed, type Take, type Throat } from 'vocals'
import type { DjDeclaration, IntroRecord, Session } from 'archive'
import type { Dj } from 'dj'
import { hum } from './perform.js'

/** How long an intro lasts, in seconds, whatever the Song's tempo. */
export const introSeconds = 15

/** How many beats of a Song at `bpm` the intro's music is counted in: four bars' worth of shape, in the length it has. */
export const introBeats = (bpm: number) => (introSeconds * bpm) / 60

/** What an intro leads into, and who hums it, as a Song's Session tells. */
export type Opening = {
  /** The first verse's first line as it was sung, by degrees of the Song's mode. */
  phrase: Phrase
  key: Key
  body: Singer
  tempo: number
  /** The lead's own throat, which hums the guide. */
  throat: Throat
  /** The Song's Mood as far as the band hears it. */
  mood: Mood
}

/**
 * What a Song's intro leads into: the first line of its first verse as the
 * lead sang it, heard as degrees of the mode. Nothing if the Session holds no
 * take of it.
 */
export function openingOf(session: Session): Opening | undefined {
  const body = session.singers[0]?.body ?? 'female'
  const mode = session.mode as ModeName
  const key = keyFor(body, mode)
  const lead = session.recordings.filter((r) => r.kind === 'voice' && r.voice === 0 && r.take).sort((a, b) => a.at - b.at)
  const first = session.iterations[0]?.parts.find((part) => part.type === 'verse')?.lines[0]
  const sung = (first ? lead.find((r) => Math.abs(r.at - first.at) < 0.05) : undefined) ?? lead.find((r) => !/\booh\b/.test(r.take!.lyrics))
  const take = sung?.take
  const sounding = take?.notes.filter(([midi]) => midi > 0) ?? []
  if (!take || !sounding.length) return undefined
  return {
    phrase: { notes: sounding.map(([midi, beats]): [number, number] => [nearestDegree(midi, key), beats]), rest: 0 },
    key,
    body,
    tempo: session.tempo,
    throat: {
      pressure: take.pressure ?? 9,
      tension: take.tension ?? 0.55,
      breathiness: take.breathiness ?? 0.15,
    },
    mood: { descriptions: session.mood, character: { mode, tempo: session.tempo, ...(session.sound ? { sound: session.sound } : {}) } },
  }
}

/**
 * What the band is asked for under the intro: the Song's own sound and key,
 * without its tempo, and without anything rhythmic. A band the mind heard as
 * drums, or percussion, or a beat, is not asked for as it is heard: the
 * Mood's other words are, or, with none, warm sustained pads.
 */
export function unrhythmic(mood: Mood): string {
  const rhythmic = /\b(drums?|drumming|percussion|percussive|beats?|snares?|kicks?|hi-?hats?|rhythm\w*|tabla|bongos?|congas?|claps?|clapping|groove\w*)\b/i
  const kept = [mood.character.sound, ...mood.descriptions].filter((word): word is string => Boolean(word) && !rhythmic.test(word!))
  const sound = (mood.character.sound && !rhythmic.test(mood.character.sound) ? [mood.character.sound] : kept).slice(0, 2)
  const key = words(mood).split(', ').at(-1)!
  return [...(sound.length ? sound : ['warm sustained pads']), 'slow, sustained, ambient', key, 'no drums, no percussion, no rhythm'].join(', ')
}

/**
 * The intro's notes, in MIDI and beats, folded into the reach of the lead's
 * body: from nothing into the first verse's first line, as it was sung.
 */
export function introScore(opened: Opening): Score {
  const pitches = opening({ to: opened.phrase, toKey: opened.key, beats: introBeats(opened.tempo) })
  const [low, high] = vocalRange[opened.body]
  const notes = pitches.map(([midi, beats]): [number, number] => {
    let m = midi
    while (m < low) m += 12
    while (m > high) m -= 12
    return [m, beats]
  })
  return { bpm: opened.tempo, lyrics: hum(notes.length), notes }
}

/**
 * The band's bed for the intro, grown from the lead's hum of its notes, the
 * band awake. The bed is grown a little longer than the intro, so that it
 * goes on into the Song and fades under it.
 */
export async function growIntro(opened: Opening): Promise<Placed> {
  const held = holdLast(introScore(opened), (tail * opened.tempo) / 60)
  // steady, without a singer's wavering: it is a map, not a performance
  const take: Take = { ...held, t0: 0.05, vibrato: 0, ...opened.throat }
  const guide = await record(take, opened.body)
  const file = await accompany({ vocals: guide, mood: unrhythmic(opened.mood), seconds: introSeconds + tail, melody: true })
  return { file, at: -introSeconds, gain: 0.45, seconds: introSeconds, fade: tail }
}

/** How much of the intro passes before the DJ speaks: the held tone is heard first. */
export const leadIn = 0.9

/** How fast a DJ speaks, in syllables a second, as Chimera says it: what the length of a speech is told by. */
export const syllablesASecond = 3.9

/** What a DJ says in the intro of a Song: `text`, of `syllables`, as the DJ would say it. */
export function declare(dj: Dj, song: string, text: string, syllables: number): DjDeclaration {
  return {
    dj: dj.name,
    song,
    parts: { intro: { at: leadIn, seconds: Math.round((syllables / syllablesASecond) * 10) / 10, speech: { text } } },
  }
}

/** A Song's intro as the Archive keeps it, beside its Session, once its music is in. */
export const introRecord = (song: string, id: string, bed: Placed, loudness?: { lufs: number; peak: number }): IntroRecord => ({
  song,
  seconds: introSeconds,
  recording: {
    id,
    at: bed.at,
    gain: bed.gain,
    kind: 'bed',
    seconds: introSeconds,
    ...(bed.fade ? { fade: bed.fade } : {}),
    ...(loudness ? { loudness } : {}),
  },
})
