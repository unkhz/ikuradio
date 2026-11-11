// The Singers are throats: a body (male, female or child), and the part each
// one sings. A Song gathers a small choir. The first voice leads and sings
// every line. The others only join in the chorus, the way a congregation
// knows the refrain but not the verses.

import type { Singer } from 'melody'
import type { Throat } from './humanize.js'

export type Voice = {
  body: Singer
  /** Scale steps from the tune: 0 is the tune, -2 a third below, -4 a fifth below. */
  harmony: number
  /** How loud this voice is in the mix, 1 being the lead. */
  gain: number
  /** The singer's own throat. Missing in choirs gathered before singers had one. */
  throat?: Throat
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

/**
 * A throat for a singer: somewhere between soft and breathy, and pressed and
 * clear, never far from how Chimera sings by default. The softer a throat
 * breathes, the more air escapes it.
 */
export function throatOf(random: () => number): Throat {
  const press = random()
  const round = (n: number) => Math.round(n * 100) / 100
  return {
    pressure: round(7.5 + 3 * press),
    tension: round(0.45 + 0.2 * (press * 0.6 + random() * 0.4)),
    breathiness: round(0.25 - 0.17 * press),
  }
}

/** Gathers a choir of `size` voices for a new Song. `random` returns a number in [0, 1). */
export function gather(
  size: number,
  random: () => number = Math.random,
): Choir {
  const pick = () => bodies[Math.floor(random() * bodies.length)]
  return [
    { body: pick(), harmony: 0, gain: 1, throat: throatOf(random) },
    ...parts
      .slice(0, Math.max(0, size - 1))
      .map((part) => ({ body: pick(), ...part, throat: throatOf(random) })),
  ]
}

/** How a choir reads, for anyone watching. */
export function introduce(choir: Choir) {
  const [lead, ...rest] = choir
  return rest.length === 0
    ? `${lead.body} alone`
    : `${lead.body}, with ${rest.map((v) => v.body).join(' and ')}`
}
