// The Singers are throats: a body (male, female or child), and the part each
// one sings. A Song gathers a small choir. The first voice leads and sings
// every line. The others only join in the chorus, the way a congregation
// knows the refrain but not the verses.

import type { Singer } from 'melody'

export type Voice = {
  body: Singer
  /** Scale steps from the tune: 0 is the tune, -2 a third below, -4 a fifth below. */
  harmony: number
  /** How loud this voice is in the mix, 1 being the lead. */
  gain: number
}

/** The lead comes first. */
export type Choir = Voice[]

const bodies: Singer[] = ['female', 'male', 'child']

/** The voices that may join the lead, from the closest harmony to the widest. */
const parts = [
  { harmony: -2, gain: 0.55 },
  { harmony: -4, gain: 0.45 },
  { harmony: -7, gain: 0.4 },
]

/** The choir the song was first sung with: the voice it had alone, now with two others behind it. */
export const firstChoir: Choir = [
  { body: 'female', harmony: 0, gain: 1 },
  { body: 'child', harmony: -2, gain: 0.55 },
  { body: 'male', harmony: -4, gain: 0.45 },
]

/** Gathers a choir of `size` voices for a new Song. `random` returns a number in [0, 1). */
export function gather(
  size: number,
  random: () => number = Math.random,
): Choir {
  const pick = () => bodies[Math.floor(random() * bodies.length)]
  return [
    { body: pick(), harmony: 0, gain: 1 },
    ...parts
      .slice(0, Math.max(0, size - 1))
      .map((part) => ({ body: pick(), ...part })),
  ]
}

/** How a choir reads, for anyone watching. */
export function introduce(choir: Choir) {
  const [lead, ...rest] = choir
  return rest.length === 0
    ? `${lead.body} alone`
    : `${lead.body}, with ${rest.map((v) => v.body).join(' and ')}`
}
