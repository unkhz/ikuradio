// How a DJ's body is moved by what they say. A speech is read as a few
// movements, each at a syllable: the mouth opens as it sounds, the body bobs
// where the voice rises. How wide and how far is the DJ's own (Movements).

import type { Movements } from './dj.js'
import { breath, type Speech } from './speech.js'

/** One movement: when it begins, seconds from the start of the speech, how long it lasts. */
export type Movement = {
  at: number
  seconds: number
  /** How open the mouth is at its widest, 0 to 1. */
  mouth: number
  /** How far the body bobs, 0 to 1. */
  bob: number
}

/** The movements of a speech, one for each syllable it says, in time. */
export function movementsOf(speech: Pick<Speech, 'bpm' | 'notes'>, how: Movements): Movement[] {
  const sounding = speech.notes.filter(([midi]) => midi > 0)
  const mean = sounding.reduce((sum, [midi]) => sum + midi, 0) / Math.max(1, sounding.length)
  const moves: Movement[] = []
  let at = breath
  let before = mean
  for (const [midi, beats] of speech.notes) {
    const seconds = (beats * 60) / speech.bpm
    if (midi > 0) {
      const rise = Math.max(0, Math.min(1, (midi - before) / 3 + (midi - mean) / 6))
      moves.push({
        at,
        seconds: Math.max(how.least, seconds),
        mouth: how.mouth * Math.min(1, 0.55 + 0.45 * Math.min(1, seconds / 0.35)),
        bob: how.bob * rise,
      })
      before = midi
    }
    at += seconds
  }
  return moves
}
