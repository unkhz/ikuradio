// A mix by ear. Every Recording says how loud it sounds; a Receiver brings
// each to the loudness it wants for its kind, so that one line is not
// louder than the next only because the throat happened to sing it louder.
// This is one Receiver's choice of loudness, written down so that the page
// and the terminal make the same one. Another Receiver may choose another.

import type { SessionRecording } from './session.js'

/** How loud the lead voice is brought to sound, in LUFS. */
export const voiceLoudness = -16
/** How far under the voices the Music lies, in LU. */
export const bedsUnder = 6
/** The most a quiet Recording is raised, in dB: a near-silent one is not made loud. */
export const mostRaised = 12
/** How close to the edge any Recording may come, in dBTP. */
export const ceiling = -1

/**
 * How loud to play a Recording, as a gain to multiply it by. A voice keeps
 * the balance the Studio gave the choir, beneath its lead; a bed lies
 * under the voices. A Recording that was not measured is played at the
 * gain the Studio gave it.
 */
export function levelOf({ kind, gain, loudness }: SessionRecording): number {
  if (!loudness) return gain ?? 1
  const wanted =
    kind === 'voice'
      ? voiceLoudness + 20 * Math.log10(gain ?? 1)
      : voiceLoudness - bedsUnder
  const raise = Math.min(mostRaised, wanted - loudness.lufs, ceiling - loudness.peak)
  return Math.round(10 ** (raise / 20) * 1000) / 1000
}
