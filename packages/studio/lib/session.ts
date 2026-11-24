// What the Session keeps of what the Studio made. The Session itself is written from the Arrangement's timeline (./timeline.ts): every iteration laid end to end,
// every line at its moment with its typing decided, every Recording where its Block says.

import type { Placed, Take } from 'vocals'
import type { Iteration } from './compose.js'
import type { SungLine } from './perform.js'
import type { Guide } from './guide.js'
import type { KeyedSynth } from './synth.js'

/** One iteration as the Studio made it: composed, sung, and with its beds and procedural tracks. */
export type Made = {
  composed: Iteration
  lines: SungLine[]
  beds: (Placed & { key?: string })[]
  /** The guide hums the Music grew the beds from. */
  guides?: Guide[]
  /** Procedural non-MusicGen tracks (`drone`, `pulse`) rendered for this iteration. */
  synths?: KeyedSynth[]
}

export const seconds = (n: number) => Math.round(n * 1000) / 1000

/** A take as a Session keeps it: only what the throat reads. */
export const takeOf = ({ bpm, lyrics, notes, t0, vibrato, pressure, tension, breathiness }: Take) => ({
  bpm,
  lyrics,
  notes,
  t0,
  vibrato,
  ...(pressure !== undefined ? { pressure } : {}),
  ...(tension !== undefined ? { tension } : {}),
  ...(breathiness !== undefined ? { breathiness } : {}),
})

/** A section's progression as the Session keeps it: the style and its numbers, and, if known, where its roots came from and what they were. */
export const progressionRecord = ({ style, temperature, pull, known, unfound }: NonNullable<Guide['progression']>) => ({
  style,
  temperature,
  pull,
  ...(known?.roots ? { from: known.from, roots: known.roots } : {}),
  ...(unfound ? { unfound } : {}),
})
