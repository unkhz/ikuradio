// How a DJ's body is moved by what they say. The speaking throat tells every
// sound it says and when: the mouth opens with the vowels, as wide as the
// vowel is open, closes on the lips' sounds, and the body bobs on a vowel
// that is stressed. How wide and how far is the DJ's own (Movements).

import type { Movements } from './dj.js'

/** One sound the speaking throat says: what it is, when it begins and ends, in seconds, its stress if it is a vowel, and its kind. */
export type Segment = { ipa: string; t0: number; t1: number; stress?: number; kind: string }

/** One movement: when it begins, seconds from the start of the speech, how long it lasts. */
export type Movement = {
  at: number
  seconds: number
  /** How open the mouth is at its widest, 0 to 1. */
  mouth: number
  /** How far the body bobs, 0 to 1. */
  bob: number
}

/** How open the mouth is for a vowel: wide for the open ones, narrow for the close ones. */
export function openness(ipa: string): number {
  if (/[ɑaɐɒæ]/.test(ipa)) return 1
  if (/[ɔʌɛeəɜɝoɚ]/.test(ipa)) return 0.65
  if (/[iuɪʊyɨ]/.test(ipa)) return 0.4
  return 0.55
}

/** The movements of a speech, from its sounds: the vowels open the mouth, the lips' sounds shut it, the others only stir it. */
export function movementsOf(segments: readonly Segment[], how: Movements): Movement[] {
  return segments.flatMap((segment): Movement[] => {
    const seconds = Math.max(how.least, segment.t1 - segment.t0)
    if (segment.kind === 'vowel') {
      return [{ at: segment.t0, seconds, mouth: how.mouth * openness(segment.ipa), bob: segment.stress === 1 ? how.bob : segment.stress === 2 ? how.bob * 0.4 : 0 }]
    }
    // the lips meet on p, b and m: the mouth is shut; any other consonant opens it a little
    if (/^[pbmɱ]/.test(segment.ipa)) return [{ at: segment.t0, seconds, mouth: 0, bob: 0 }]
    if (segment.kind === 'glottal' || /^[ʔh]/.test(segment.ipa)) return []
    return [{ at: segment.t0, seconds, mouth: how.mouth * 0.25, bob: 0 }]
  })
}
