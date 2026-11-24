// A Part (plan "Evolution of Song"): a piece of a Song, and the one thing every
// piece is. Verse, chorus and bridge are subclasses of it, each in a folder of
// its own beside this one, and whatever takes a Part takes any of them. What
// one part is told apart from another by lives in the part, as a scalar where
// it is a number or a name, and as a method where it depends on the moment.
//
// Every part may sing. Singing needs melody and the throat's pronouncing, so
// every part depends on what singing needs; a part that hums has the same
// dependencies and does not use them.

import type { TSchema } from 'typebox'
import { Value } from 'typebox/value'
import type { Phrase, Tune } from 'melody'

/** Where a part stands in its Song, for the parts that depend on it. */
export type Place = {
  /** The iteration the part is sung in. */
  iteration: bigint
  /** Whether it is the last part of its Arrangement: the last part comes home. */
  last: boolean
  /** The id of the part before it, if any: a bridge's journey begins where that part ends. */
  before?: string
  /** The id of the part after it, if any: and ends where that part begins. */
  after?: string
  /** How its instance says it ends, if it does: that takes the place of the part's own ending. */
  ending?: 'full' | 'half'
}

/** What a part is asked to count a line by: which line, the tune, the tempo and rate, and the part's own parameters. */
export type LineContext = {
  /** The line, from 0, within the part. */
  line: number
  /** The tune the Song is sung to. */
  tune: Tune
  /** Beats a minute. */
  tempo: number
  /** Syllables a second, at the most. */
  rate: number
  /** The part's parameters as its instance sets them; those not set are the part's own defaults. */
  parameters: Readonly<Record<string, number>>
}

/** How many syllables a line is meant to have, how many it may have, and whether it may grow past its bars. */
export type LineMeasure = { target: number; most: number; grows: boolean }

export type WordMode = 'written' | 'spoken' | 'none' | 'silent'

export abstract class Part {
  /** Its name, the folder's: never reused, and never removed once a Song has been made with it. */
  abstract readonly id: string
  /** Whether it has words: written (sung by the choir), spoken (said in free or gridded time), none (wordless music/hum), or silent (pure pause). */
  abstract readonly words: WordMode
  /** How it ends, unless its place says otherwise: home, or open on the fifth. */
  abstract readonly ending: 'full' | 'half'
  /** A fixed length in beats (a bridge: 16); without it, as long as its lines or `durationSeconds`. */
  readonly beats?: number
  /** How many lines the mind writes for this part by default (4 for verse/chorus, 2 for pre-chorus/spoken/refrain, 0 for wordless/silent). */
  readonly lines?: number
  /** Guidance for the mind when writing words for an instance of this part that is not one of the Song as it always was's fields. */
  readonly instruction?: string
  /** Its parameters and their ranges, as a TypeBox schema: wordiness, ceiling, span, travel. */
  abstract readonly parameters: TSchema

  /** A part's parameters as its instance sets them, with the schema's defaults filled in for those not set: the one place a default is said is the schema. */
  protected given(parameters: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
    return Value.Default(this.parameters, { ...parameters }) as Record<string, number>
  }

  /** THE interchangeable contract: how many syllables line `line` should carry and may carry, and whether it may grow past its bars. */
  abstract measure(line: LineContext): LineMeasure
  /** The phrases its lines are sung to, from the Song's tune. A part with no sung words has none. */
  abstract phrases(tune: Tune, place: Place): Phrase[]
  /** A line that is not the mind's to write, if any (the chorus's first: the Song's age). */
  fixedLine?(line: number, place: Place): string | undefined
  /** How long this part lasts in seconds, when determined by its parameters rather than lines or fixed `beats` (e.g. `interlude`, `silence`). */
  durationSeconds?(tempo: number | null, parameters: Readonly<Record<string, number>>): number | undefined
}
