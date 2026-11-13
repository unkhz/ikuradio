// The Facets: the parts of the Studio's work a Perspective may change. Each
// is one hook in the Studio's code, and each has a Setting: what the hook
// does by default, and all a Perspective may change about it. A Turn takes
// the default Setting and returns its own, never anything else, so a
// Perspective can only change what its Facet's hook offers.
//
// Keep the list in step with .arkku/templates/perspective.ts.

export const facets = [
  'development',
  'choir',
  'humanness',
  'bridge-singers',
  'bridge-beds',
  'drift',
] as const

export type Facet = (typeof facets)[number]

export type Settings = {
  /**
   * How far the Song's other Variations move from its tune: how many verse
   * phrases each ornaments, and how many steps each ornament takes.
   * Hooked where the Variations are made (melody's `variations`).
   */
  development: { ornaments: number; steps: number }
  /**
   * How many sing (the lead, then a third, a fifth and an octave below), and
   * whether the harmonies sing the verses too, not only the chorus. Hooked
   * where the choir is gathered and where a line's singers are chosen.
   */
  choir: { size: number; verses: boolean }
  /** How far a take wanders from the score: 1 as usual. Hooked in `humanize`. */
  humanness: { scale: number }
  /**
   * How often a bridge is hummed aloud, from 0 to 1, and whether the choir
   * hums with the lead. Hooked where a bridge is performed.
   */
  'bridge-singers': { humming: number; choir: boolean }
  /**
   * What the bridges' beds are told instead of the Mood's band (the tempo is
   * always told), whether the Music follows the guide's melody, and the row
   * of all twelve pitches the bridges' guides are hummed in instead of the
   * key, if they lose it. Hooked where a section's bed is grown, and where
   * its guide is hummed.
   */
  'bridge-beds': { instead?: string; melody: boolean; row?: number[] }
  /** How many of the Mood's descriptions let go when the Song begins. Hooked in `nextMood`. */
  drift: { letGo: number }
}

/** What the Studio does when no Perspective turns a Facet. */
export function defaults(choirSize: number): Settings {
  return {
    development: { ornaments: 1, steps: 1 },
    choir: { size: choirSize, verses: false },
    humanness: { scale: 1 },
    'bridge-singers': { humming: 0.5, choir: false },
    'bridge-beds': { melody: true },
    drift: { letGo: 1 },
  }
}

/** What a Turn is given beside the default Setting. */
export type TurnContext = {
  /** The Turn's own wrongness, named by the Song and the Perspective. Never Math.random. */
  random: () => number
  /** The Perspective's prompts.json, if it has one: words for a model, to choose from. */
  prompts: readonly string[]
}

/** A Turn's answer: its Setting, and the variant it chose, if it chose one, for anyone watching. */
export type Turned<F extends Facet> = { setting: Settings[F]; variant?: string }

export type Turn<F extends Facet> = (setting: Settings[F], context: TurnContext) => Turned<F>

/** What an actions.ts exports: the Facet it turns, and how. */
export type Actions<F extends Facet = Facet> = { facet: F; turn: Turn<F> }

/** Writes a Perspective's actions, typed for its Facet. */
export function turning<F extends Facet>(facet: F, turn: Turn<F>): Actions<F> {
  return { facet, turn }
}

/** Picks one of a list by a wrongness. */
export function pick<T>(list: readonly T[], random: () => number): T {
  if (list.length === 0) throw new Error('nothing to pick from')
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))]
}
