import { Type } from '@sinclair/typebox'
import type { Phrase, Tune } from 'melody'
import { wordyMeasure } from '../lib/counting.js'
import { Part, type LineContext, type LineMeasure } from '../lib/part.js'
import { melody, wordiness } from '../lib/ranges.js'

/** The verse: written words, from a memory; sung to the tune's verse phrases; ends open on the fifth. */
class Verse extends Part {
  readonly id = 'verse'
  readonly words = 'written'
  readonly ending = 'half'
  readonly parameters = Type.Object({ wordiness: wordiness(), ...melody() })

  measure({ line, tune, tempo, rate, parameters }: LineContext): LineMeasure {
    return wordyMeasure(tune.verse[line % tune.verse.length]!, tempo, rate, parameters.wordiness ?? 0.5)
  }

  phrases(tune: Tune): Phrase[] {
    return tune.verse
  }
}

export default new Verse()
