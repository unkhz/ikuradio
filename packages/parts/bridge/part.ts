import { Type } from '@sinclair/typebox'
import { bridgeBeats, type Phrase } from 'melody'
import { Part, type LineMeasure } from '../lib/part.js'
import { melody } from '../lib/ranges.js'

/**
 * The bridge: no words, sixteen beats of hum between the part before it and the part after it, and
 * its melody runs from the one to the other. It ends open on the fifth.
 */
class Bridge extends Part {
  readonly id = 'bridge'
  readonly words = 'none'
  readonly ending = 'half'
  readonly beats = bridgeBeats
  readonly parameters = Type.Object({ ...melody() })

  measure(): LineMeasure {
    return { target: 0, most: 0, grows: false }
  }

  phrases(): Phrase[] {
    return []
  }
}

export default new Bridge()
