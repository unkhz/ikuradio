// The Facets: the parts of the Studio's work a Perspective may change. Each
// is one hook in the Studio's code, and each has a Setting: what the hook
// does by default, and all a Perspective may change about it. A Turn takes
// the default Setting and returns its own, never anything else, so a
// Perspective can only change what its Facet's hook offers.
//
// Keep the list in step with .arkku/templates/perspective.ts.

import { roaming, traditional, type Harmony, type Progression } from 'melody'

export const facets = [
  'development',
  'choir',
  'humanness',
  'harmony',
  'bridge-singers',
  'bridge-voice',
  'bridge-beds',
  'verse-tune',
  'drift',
  'progression',
  'melody',
  'lyrics',
  'language',
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
  /**
   * How the harmonizer sings beside the lead: voiced by the rules, or
   * parallel as the song first sang; on which side of the lead; how far the
   * first voice above stands; how widely the voices below spread. Hooked
   * where the choir is gathered, and wherever a voice sings beside the lead.
   */
  harmony: Harmony
  /** How far a take wanders from the score: 1 as usual. Hooked in `humanize`. */
  humanness: { scale: number }
  /**
   * How often a bridge is hummed aloud, from 0 to 1, and whether the choir
   * hums with the lead. Hooked where a bridge is performed.
   */
  'bridge-singers': { humming: number; choir: boolean }
  /**
   * What a hummed bridge sings, a syllable a note, drawn from these without
   * saying one twice in a row; an "ooh" on every note, without them. The
   * guide the Music grows from is always hummed. Hooked where a bridge is
   * performed.
   */
  'bridge-voice': { syllables?: string[] }
  /**
   * What the bridges' beds are told instead of the Mood's band (the tempo is
   * always told), whether the Music follows the guide's melody, and the row
   * of all twelve pitches the bridges' guides are hummed in instead of the
   * key, if they lose it. Hooked where a section's bed is grown, and where
   * its guide is hummed.
   */
  'bridge-beds': { instead?: string; melody: boolean; row?: number[] }
  /**
   * Whether the Song plays its verse as it remembers it, or as a melody
   * written anew for this Song alone, to the verse's own rhythm. The tune
   * the Song remembers, and passes on to the next, is never rewritten.
   * Hooked where an iteration's tune is chosen.
   */
  'verse-tune': { unfamiliar: boolean }
  /** How many of the Mood's descriptions let go when the Song begins. Hooked in `nextMood`. */
  drift: { letGo: number }
  /**
   * Which chords each part's guide takes, a Setting a part: roaming along
   * the arc, with its temperature and its pull toward last iteration's
   * chords, or a known progression laid over the words' change points.
   * Where the chords change is always the words'. Hooked where a section's
   * guide is composed (`composeGuide`), before its melody is written.
   */
  progression: { verse: Progression; chorus: Progression; bridge: Progression }
  /**
   * How high and how far each part's melody goes (plan "Tides"): `ceiling`,
   * how many scale steps below the top of the voice's compass a line's
   * weightiest word is pulled to; `span`, a cost per step from a line's
   * lowest note to its highest; `travel`, a cost per step of all a line's
   * intervals added up. Hooked where the melody writer writes a line.
   */
  melody: Record<Part, Melody>
  /**
   * How wordy each part's lines are, from 0, sparse, to 1, as full as the
   * phrase can carry; 0.5 is the song as it always was. Each part decides
   * what that means. The chorus's number line is never touched; bridges
   * have no words. Hooked where the mind is told each line's count.
   */
  lyrics: { verse: Lyrics; chorus: Lyrics }
  /**
   * Which language the Song is written and sung in: `'en'` by default, or
   * `'fi'` for Finnish (written by Poro and sung via Finnish IPA syllables).
   * Hooked where the Studio wakes the mind, composes lyrics, and performs takes.
   */
  language: { code: 'en' | 'fi' }
}

/** How high and how far a part's melody goes. */
export type Melody = { ceiling: number; span: number; travel: number }

/** How wordy a part's lines are. */
export type Lyrics = { wordiness: number }

/** The melody as the writer always wrote it: the weightiest word two steps below the top, nothing narrowing or stilling it. */
export const usualMelody: Melody = { ceiling: 2, span: 0, travel: 0 }

/** The words as the song always wrote them. */
export const usualLyrics: Lyrics = { wordiness: 0.5 }

/** The parts a Setting may be kept for, one each: Perspectives on different parts of one Facet may be heard together. */
export const parts = ['verse', 'chorus', 'bridge'] as const
export type Part = (typeof parts)[number]

/** What the Studio does when no Perspective turns a Facet. */
export function defaults(choirSize: number): Settings {
  return {
    development: { ornaments: 1, steps: 1 },
    choir: { size: choirSize, verses: false },
    harmony: { ...traditional },
    humanness: { scale: 1 },
    'bridge-singers': { humming: 0.5, choir: false },
    'bridge-voice': {},
    'bridge-beds': { melody: true },
    'verse-tune': { unfamiliar: false },
    drift: { letGo: 1 },
    progression: { verse: { ...roaming }, chorus: { ...roaming }, bridge: { ...roaming } },
    melody: { verse: { ...usualMelody }, chorus: { ...usualMelody }, bridge: { ...usualMelody } },
    lyrics: { verse: { ...usualLyrics }, chorus: { ...usualLyrics } },
    language: { code: 'en' },
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
