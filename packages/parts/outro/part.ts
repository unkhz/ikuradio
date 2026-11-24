import { Type } from 'typebox'
import type { Phrase, Tune } from 'melody'
import { wordyMeasure } from '../lib/counting.js'
import { Part, type LineContext, type LineMeasure } from '../lib/part.js'
import { melody, wordiness } from '../lib/ranges.js'

/**
 * The outro: a dramatic, slow-motion ending written by the mind (3 lines by
 * default, configurable 1–4). Stretches the final phrases of the chorus to
 * double-length sustain so the voice soars and settles home over vast open space.
 */
class Outro extends Part {
  readonly id = 'outro'
  readonly words = 'written'
  readonly ending = 'full'
  readonly lines = 3
  readonly instruction =
    'Write a dramatic, resonant ending — as if the whole song has climbed to a cliff edge and now releases into vast open space.'
  readonly parameters = Type.Object({
    lines: Type.Integer({ minimum: 1, maximum: 3, default: 3, description: 'How many slow, resonant lines the outro carries' }),
    wordiness: wordiness(),
    ...melody(),
  })

  measure({ line, tune, tempo, rate, parameters }: LineContext): LineMeasure {
    const phrases = this.phrases(tune)
    return wordyMeasure(phrases[line % phrases.length]!, tempo, rate, this.given(parameters).wordiness!)
  }

  phrases(tune: Tune): Phrase[] {
    return tune.chorus.slice(-3).map((phrase) => ({
      ...phrase,
      notes: phrase.notes.map(([degree, beats]): [number, number] => [degree, beats * 2]),
      rest: phrase.rest * 2,
    }))
  }
}

export default new Outro()
