// What a DJ says is text. It is said by the speaking throat, which turns it
// into samples and tells when each of its sounds is said; here is what a DJ
// asks of it. Only the Receiver says it: the Studio need only know that the
// words are of a sensible length (packages/song/lib/speeches.ts).

import type { Dj } from './dj.js'
import { dramaOf } from './drama.js'

/** What the speaking throat is asked: the text and the DJ's voice, sped by `squeeze` when the words are many for their room. */
export type Request = { text: string; body: Dj['voice']['body']; f0: number; rate: number; accent?: number; pressure?: number; tension?: number; breathiness?: number; stretch?: [number, number][] }

/** The request for `text` in a DJ's voice. */
export const requestOf = (dj: Dj, text: string, squeeze = 1): Request => {
  const { body, f0, rate, accent, pressure, tension, breathiness, drama } = dj.voice
  const stretch = drama ? dramaOf(text, drama) : []
  return {
    text,
    body,
    f0,
    rate: Math.round(rate * squeeze * 1000) / 1000,
    ...(accent !== undefined ? { accent } : {}),
    ...(pressure !== undefined ? { pressure } : {}),
    ...(tension !== undefined ? { tension } : {}),
    ...(breathiness !== undefined ? { breathiness } : {}),
    ...(stretch.length ? { stretch } : {}),
  }
}
