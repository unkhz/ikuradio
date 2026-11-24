import { Type } from 'typebox'
import type { Phrase, Tune } from 'melody'
import { wordyMeasure } from '../lib/counting.js'
import { Part, type LineContext, type LineMeasure } from '../lib/part.js'
import { melody, wordiness } from '../lib/ranges.js'

/**
 * The refrain: a short one- or two-line echoing tag or coda that recalls the
 * heart of the song and settles home on the tonic.
 */
class Refrain extends Part {
  readonly id = 'refrain'
  readonly words = 'written'
  readonly ending = 'full'
  readonly lines = 2
  readonly instruction = 'Write a short, resonant refrain or coda that echoes the heart of the song and brings it home.'
  readonly parameters = Type.Object({
    lines: Type.Integer({ minimum: 1, maximum: 2, default: 2, description: 'How many echoing lines the refrain carries' }),
    wordiness: wordiness(),
    ...melody(),
  })

  measure({ line, tune, tempo, rate, parameters }: LineContext): LineMeasure {
    const phrases = this.phrases(tune)
    return wordyMeasure(phrases[line % phrases.length]!, tempo, rate, this.given(parameters).wordiness!)
  }

  phrases(tune: Tune): Phrase[] {
    return tune.chorus.slice(-2)
  }
}

export default new Refrain()
