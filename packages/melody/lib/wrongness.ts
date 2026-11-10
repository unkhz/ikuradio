// Small wrongness: the only kind of chance the song allows itself.
//
// It is not random. A name always gives the same wrongness, so anything made
// from it can be made again, exactly, from the name alone. Only a new name
// gives something new, and then only a little.

import { createHash } from 'node:crypto'

/** A source of small wrongness: a number in [0, 1) that is always the same for the same name. */
export function wrongness(name: string): () => number {
  // mulberry32, seeded from the name
  let state = createHash('sha256').update(name).digest().readUInt32LE(0)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
