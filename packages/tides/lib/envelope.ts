// A Tide's envelope (plan "Tides"): how one setting rises and falls over
// many Songs. A cycle lasts its age, a number of Songs drawn from a range,
// and within it the setting climbs from its rest to its peak, holds there,
// falls back, and rests again until the next cycle begins.
//
// The song is meant to sing for a quadrillion years, so a Song's cycle is
// never found by counting cycles from the first. Eternity is cut in halves:
// a span of about 2^50 cycles, whose length is known, is split into two halves,
// each half's length drawn from the Tide's wrongness so that the two add up
// to the whole and every cycle in it can still be between the shortest and
// longest age. The half the Song falls in is split again, and again, fifty
// times, until one cycle is left. The same Tide always cuts eternity the
// same way, so every Song always sits at the same place in it.

import { wrongness } from 'melody'

/** A Tide's envelope, in Songs and in the setting's own units. */
export type Envelope = {
  /** How many Songs one cycle lasts: the shortest and the longest, each cycle drawing its own. */
  age: readonly [number, number]
  /** The shares of a cycle spent rising, at the peak, and falling; the rest is spent at rest. */
  attack: number
  hold: number
  decay: number
  /** The setting at rest, and at the peak. */
  min: number
  max: number
}

/** Where in its envelope a cycle stands. */
export type Phase = 'rising' | 'holding' | 'falling' | 'resting'

/** A Tide at one moment: its value, and its place in its cycle. */
export type Reading = {
  value: number
  phase: Phase
  /** How far through its phase, from 0 to 1. */
  through: number
  /** Which cycle, from 0, and how long it lasts, in Songs. */
  cycle: number
  age: number
}

/** How long eternity may be, in Songs, for its length to be counted exactly: 2^52. */
const exactly = 52

/** A number from a standard normal distribution, from two of a wrongness. */
function normal(random: () => number) {
  const u = Math.max(1e-12, random())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

/**
 * The cycle a position falls in, `position` counted in Songs from Song 0:
 * which one, where it begins, and how long it lasts. Found by halving, never
 * by counting.
 */
export function cycleAt(slug: string, [shortest, longest]: readonly [number, number], position: number): { cycle: number; begins: number; age: number } {
  const lo = Math.max(1, Math.round(Math.min(shortest, longest)))
  const hi = Math.max(lo, Math.round(Math.max(shortest, longest)))
  // the spread of one cycle's age, for drawing how two halves share their length
  const variance = ((hi - lo + 1) ** 2 - 1) / 12
  // as many halvings as keep eternity's length exact: about fifty, for cycles of a few Songs
  let count = 2 ** Math.floor(exactly - Math.log2(hi))
  let length = Math.round((count * (lo + hi)) / 2)
  let first = 0
  let begins = 0
  // beyond the end of eternity it begins again; a fraction is kept by never adding eternity to a Song that is in it
  let at = position % length
  if (at < 0) at += length
  let node = 1
  while (count > 1) {
    const half = count / 2
    const random = wrongness(`tide:${slug}:${node}`)
    // the first half's length: about its share, as far off it as sums of ages wander, and never impossible
    const least = Math.max(half * lo, length - half * hi)
    const most = Math.min(half * hi, length - half * lo)
    const drawn = Math.round(length / 2 + normal(random) * Math.sqrt((count * variance) / 4))
    const left = Math.min(most, Math.max(least, drawn))
    if (at < left) {
      count = half
      length = left
      node = node * 2
    } else {
      at -= left
      begins += left
      first += half
      count = half
      length -= left
      node = node * 2 + 1
    }
  }
  return { cycle: first, begins, age: length }
}

/** The setting at a position, and where its cycle stands. */
export function readAt(slug: string, envelope: Envelope, position: number): Reading {
  const { attack, hold, decay, min, max } = envelope
  const { cycle, begins, age } = cycleAt(slug, envelope.age, position)
  const u = Math.min(1, Math.max(0, (position - begins) / age))
  const share = (part: number) => Math.max(0, part)
  const [a, h, d] = [share(attack), share(hold), share(decay)]
  const between = (from: number, to: number, x: number) => from + (to - from) * x
  if (u < a) return { value: between(min, max, u / a), phase: 'rising', through: u / a, cycle, age }
  if (u < a + h) return { value: max, phase: 'holding', through: (u - a) / h, cycle, age }
  if (u < a + h + d) return { value: between(max, min, (u - a - h) / d), phase: 'falling', through: (u - a - h) / d, cycle, age }
  const rest = 1 - a - h - d
  return { value: min, phase: 'resting', through: rest > 0 ? (u - a - h - d) / rest : 1, cycle, age }
}
