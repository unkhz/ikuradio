import { Type } from 'typebox'
import type { Phrase, Tune } from 'melody'
import { wordyMeasure } from '../lib/counting.js'
import { Part, type LineContext, type LineMeasure } from '../lib/part.js'
import { melody, wordiness } from '../lib/ranges.js'

/**
 * The pre-chorus: two rising lines written by the mind, leaning forward out of
 * a verse toward a chorus. Uses the last two phrases of the verse lifted by a
 * scale step, and ends open on the fifth.
 */
class PreChorus extends Part {
  readonly id = 'pre-chorus'
  readonly words = 'written'
  readonly ending = 'half'
  readonly lines = 2
  readonly instruction = 'Write a two-line pre-chorus that lifts the tension and leans forward into what comes next.'
  readonly parameters = Type.Object({ wordiness: wordiness(), ...melody() })

  measure({ line, tune, tempo, rate, parameters }: LineContext): LineMeasure {
    const phrases = this.phrases(tune)
    return wordyMeasure(phrases[line % phrases.length]!, tempo, rate, this.given(parameters).wordiness!)
  }

  phrases(tune: Tune): Phrase[] {
    return tune.verse.slice(-2).map((phrase) => ({
      ...phrase,
      notes: phrase.notes.map(([degree, beats]): [number, number] => [degree + 1, beats]),
    }))
  }
}

export default new PreChorus()
