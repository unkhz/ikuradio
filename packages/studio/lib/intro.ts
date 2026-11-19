// The intro (plan "Intro with Rezzy"): four bars before a Song, from nothing
// into its first verse, with a bed the band grows from them, and a DJ's
// speech to be said over them. Songs made from here have one. It lies before
// the Song's moment 0, so nothing in the Song moves for it.

import { holdLast, keyFor, opening, phraseOf, vocalRange, type Score } from 'melody'
import { accompany, tail, words } from 'music'
import { record, throatScore, type Placed, type Take } from 'vocals'
import { fit, type Dj, type Request, type Said } from 'dj'
import type { DjDeclaration } from 'archive'
import type { Iteration } from './compose.js'
import { hum } from './perform.js'

/** An intro is four bars of four beats. */
export const introBeats = 16

/** How long the intro lasts at a Song's tempo, in seconds. */
export const introSeconds = (bpm: number) => Math.round(((introBeats * 60) / bpm) * 1000) / 1000

/**
 * The intro's notes, in MIDI and beats, folded into the reach of the lead's
 * body: from nothing into the first verse's first line, as the tune of this
 * Song's first iteration sings it.
 */
export function introScore(first: Iteration): Score {
  const [lead] = first.choir
  const { character } = first.mood
  const key = keyFor(lead.body, character.mode)
  const pitches = opening({
    to: phraseOf(first.sung, 'verse', 0),
    toKey: key,
    beats: introBeats,
    harmony: lead.harmony,
  })
  const [low, high] = vocalRange[lead.body]
  const notes = pitches.map(([midi, beats]): [number, number] => {
    let m = midi
    while (m < low) m += 12
    while (m > high) m -= 12
    return [m, beats]
  })
  return { bpm: character.tempo, lyrics: hum(notes.length), notes }
}

/**
 * The band's bed for the intro, grown from the lead's hum of its notes, the
 * band awake. The bed is grown a little longer than the intro, so that it
 * goes on into the Song and fades under it.
 */
export async function growIntro(first: Iteration): Promise<Placed> {
  const [lead] = first.choir
  const bpm = first.mood.character.tempo
  const held = holdLast(introScore(first), (tail * bpm) / 60)
  // steady, without a singer's wavering: it is a map, not a performance
  const take: Take = { ...held, t0: 0.05, vibrato: 0, ...lead.throat }
  const guide = await record(take, lead.body)
  const seconds = introSeconds(bpm)
  const file = await accompany({ vocals: guide, mood: words(first.mood), seconds: seconds + tail, melody: true })
  return { file, at: -seconds, gain: 0.45, seconds, fade: tail }
}

/** How much of the intro passes before the DJ speaks: the held tone is heard first. */
export const leadIn = 0.9
/** How much of the intro the DJ leaves to the music at its end, before the Song begins. */
export const leadOut = 0.6

/**
 * What a DJ says in the intro of a Song: `text`, as the DJ would say it,
 * fitted to the room the music leaves, hurried a little or cut to fewer
 * words if it must be. `say` is the speaking throat. Nothing if not even a
 * word fits.
 */
export async function declare(dj: Dj, song: string, bpm: number, text: string, say: (request: Request) => Promise<Said> | Said): Promise<DjDeclaration | undefined> {
  const room = introSeconds(bpm) - leadIn - leadOut
  const fitted = await fit(dj, text, room, say)
  if (!fitted) return undefined
  return {
    dj: dj.name,
    song,
    parts: { intro: { at: leadIn, seconds: fitted.seconds, speech: { text: fitted.text, ...(fitted.squeeze !== 1 ? { squeeze: fitted.squeeze } : {}) } } },
  }
}
