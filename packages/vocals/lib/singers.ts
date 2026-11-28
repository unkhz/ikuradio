// The Singers are throats: a body (male, female or child), and the part each
// one sings. A Song gathers a small choir. The first voice leads and sings
// every line. The others only join in the chorus, the way a congregation
// knows the refrain but not the verses.

import type { BodyMix, Breath, Singer } from 'melody'
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

const round2 = (n: number) => Math.round(n * 100) / 100
const round3 = (n: number) => Math.round(n * 1000) / 1000
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/**
 * Nudges a singer's nominal body (`male`, `female`, `child`) into a continuous
 * Chimera `BodyMix` proportional to `morph` (0 = exact preset, 0.15 = subtle
 * vocal-tract individuality so two singers of the same body sound distinct,
 * 1 = wide hybrid morphs across the male/female/child space).
 */
export function bodyMixFor(body: Singer, random: () => number, morph = 0.15): BodyMix | undefined {
  const m = clamp(morph, 0, 1)
  if (m <= 0.001) return undefined
  const base = body === 'female' ? { f: 1, c: 0 } : body === 'child' ? { f: 0, c: 1 } : { f: 0, c: 0 }
  // Target a random point in the male/female/child simplex and move `m` of the way toward it
  const tf = random()
  const tc = random() * (1 - tf * 0.5)
  const k = m * (0.35 + 0.65 * random())
  return {
    female: round2(clamp(base.f + (tf - base.f) * k, 0, 1)),
    child: round2(clamp(base.c + (tc - base.c) * k, 0, 1)),
  }
}

export type ThroatOptions = {
  /** Lead singers lean slightly brighter/clearer; harmonies slightly warmer to blend behind the lead. */
  role?: 'lead' | 'harmony'
  /** Nominal body preset, used to derive a subtle unique continuous `BodyMix`. */
  body?: Singer
  /** 0..1 how far the singer's vocal tract may wander from `body` (default 0.15). */
  morph?: number
}

/**
 * A throat for a singer: pressure, fold tension, breathiness, plus individual
 * Chimera timbre and tract personality (brightness, singer's ring, subtle fold
 * roughness, vibrato rate, pitch glide, and continuous body blend).
 *
 * Note: Chimera's `fry` parameter linearly interpolates `f0` down toward 48 Hz
 * (`glottis.rs`), so even small values (0.04–0.10) detune sung notes by 50–150
 * cents flat. Singers therefore always keep `fry` unset (0).
 */
export function throatOf(random: () => number, breath?: Breath, opts: ThroatOptions = {}): Throat {
  // the Mood's breath, if it has one, give or take a little; otherwise anywhere
  const press = breath
    ? clamp(centres[breath] + (random() - 0.5) * 0.3, 0, 1)
    : random()
  const isLead = (opts.role ?? 'lead') === 'lead'
  const brightnessBase = isLead ? 0.44 + 0.32 * random() : 0.30 + 0.34 * random()
  const epilarynxBase = isLead ? (0.04 + 0.24 * press + 0.12 * random()) : (0.0 + 0.14 * press + 0.08 * random())
  const roughness = round2(clamp(random() * random() * 0.18, 0, 0.25))
  const vibratoRate = round2(4.8 + random() * 2.0)
  const glide = round3(0.015 + random() * 0.030)
  const body = opts.body ? bodyMixFor(opts.body, random, opts.morph ?? 0.15) : undefined

  return {
    pressure: round2(7.5 + 3 * press),
    tension: round2(0.45 + 0.2 * (press * 0.6 + random() * 0.4)),
    breathiness: round2(0.25 - 0.17 * press),
    brightness: round2(clamp(brightnessBase + (press - 0.5) * 0.12, 0.15, 0.92)),
    epilarynx: round2(clamp(epilarynxBase, 0, 0.5)),
    roughness,
    vibratoRate,
    glide,
    ...(body ? { body } : {}),
  }
}

/** Where each breath sits between soft (0) and pressed (1). */
const centres: Record<Breath, number> = { soft: 0.15, plain: 0.5, pressed: 0.85 }

/**
 * Gathers a choir of `size` voices for a new Song. `random` returns a number
 * in [0, 1). If the Mood named a lead and a breath, the lead is that voice
 * and the whole choir breathes that way; the others are gathered by chance,
 * each with their own vocal timbre and tract blend.
 */
export function gather(
  size: number,
  random: () => number = Math.random,
  guide?: { lead: Singer; breath: Breath },
  /** Which of the voices beside the lead, in order, sing above it: never a man's voice, which cannot reach that high. */
  {
    high = [],
    morph = 0.15,
    harmonyMorph = morph,
  }: { high?: readonly boolean[]; morph?: number; harmonyMorph?: number } = {},
): Choir {
  const pick = () => bodies[Math.floor(random() * bodies.length)]!
  const leadBody = guide?.lead ?? pick()
  const choir: Choir = [
    {
      body: leadBody,
      harmony: 0,
      gain: 1,
      throat: throatOf(random, guide?.breath, { role: 'lead', body: leadBody, morph }),
    },
    ...parts.slice(0, Math.max(0, size - 1)).map((part, idx) => {
      let body = pick()
      if (high[idx] && body === 'male') body = random() < 0.5 ? 'female' : 'child'
      return {
        body,
        ...part,
        throat: throatOf(random, guide?.breath, { role: 'harmony', body, morph: harmonyMorph }),
      }
    }),
  ]
  return choir
}

/** How a choir reads, for anyone watching. */
export function introduce(choir: Choir) {
  const [lead, ...rest] = choir
  return rest.length === 0
    ? `${lead.body} alone`
    : `${lead.body}, with ${rest.map((v) => v.body).join(' and ')}`
}
