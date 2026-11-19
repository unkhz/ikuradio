// What a DJ says is text. It is said by the speaking throat, which turns it
// into samples and tells when each of its sounds is said; here is what a DJ
// asks of it, and how the words are fitted to the room a Song's intro leaves.

import type { Dj } from './dj.js'

/** What the speaking throat is asked: the text and the DJ's voice, sped by `squeeze` when the words are many for their room. */
export type Request = { text: string; body: Dj['voice']['body']; f0: number; rate: number; accent?: number; pressure?: number; tension?: number; breathiness?: number }

/** What the speaking throat answers: the speech's length, as it is said, tail included in the samples but not here. */
export type Said = { end: number }

/** The request for `text` in a DJ's voice. */
export const requestOf = (dj: Dj, text: string, squeeze = 1): Request => {
  const { body, f0, rate, accent, pressure, tension, breathiness } = dj.voice
  return {
    text,
    body,
    f0,
    rate: Math.round(rate * squeeze * 1000) / 1000,
    ...(accent !== undefined ? { accent } : {}),
    ...(pressure !== undefined ? { pressure } : {}),
    ...(tension !== undefined ? { tension } : {}),
    ...(breathiness !== undefined ? { breathiness } : {}),
  }
}

/** How much faster than usual a DJ may be hurried to fit: past this the words are cut instead. */
export const mostSqueeze = 1.25

/** The seconds after the last sound the speech goes on for, before its samples end. */
export const tailOf = 0.3

/** The text up to its last sentence, or, with none, its first `count` words. */
function cut(text: string, fraction: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  const keep = Math.max(1, Math.floor(words.length * fraction))
  const kept = words.slice(0, keep)
  // end on a sentence, if one ends in the second half of what is kept
  const ends = kept.map((w, i) => (/[.!?]$/.test(w) ? i : -1)).filter((i) => i >= kept.length / 2)
  const sentence = ends.at(-1)
  return (sentence === undefined ? kept : kept.slice(0, sentence + 1)).join(' ')
}

/**
 * Fits `text` into `room` seconds: said as the DJ says it, then hurried a
 * little if a little is enough, then cut to fewer words, whole sentences if
 * it can, and said again. `say` is the speaking throat. Nothing, if not even
 * a word fits.
 */
export async function fit(
  dj: Dj,
  text: string,
  room: number,
  say: (request: Request) => Promise<Said> | Said,
): Promise<{ text: string; squeeze: number; seconds: number } | undefined> {
  let words = text.trim()
  for (let tries = 0; tries < 6 && words; tries++) {
    const { end } = await say(requestOf(dj, words))
    if (end <= room) return { text: words, squeeze: 1, seconds: Math.round(end * 1000) / 1000 }
    // the pace asked of the speech to fit, if it need not be cut
    const squeeze = Math.min(mostSqueeze, Math.ceil((end / room) * 1.03 * 100) / 100)
    if (end / room <= mostSqueeze) {
      const hurried = await say(requestOf(dj, words, squeeze))
      if (hurried.end <= room) return { text: words, squeeze, seconds: Math.round(hurried.end * 1000) / 1000 }
    }
    words = cut(words, Math.min(0.9, (room / end) * mostSqueeze * 0.9))
  }
  return undefined
}
