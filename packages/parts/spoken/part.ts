import { Type } from 'typebox'
import type { Phrase } from 'melody'
import { Part, type LineMeasure } from '../lib/part.js'

/**
 * The spoken reflection: intimate poetic lines written by the mind and said aloud
 * through Chimera's speaking throat, rather than sung to bars. Works in free time
 * or under a tempo.
 */
class Spoken extends Part {
  readonly id = 'spoken'
  readonly words = 'spoken'
  readonly ending = 'half'
  readonly lines = 2
  readonly instruction = 'Write an intimate, unhurried spoken reflection — plain poetic lines meant to be said aloud rather than sung.'
  readonly parameters = Type.Object({
    lines: Type.Integer({ minimum: 1, maximum: 4, default: 2, description: 'How many spoken lines to say' }),
    rate: Type.Number({ minimum: 0.7, maximum: 1.25, default: 0.92, description: 'Speaking pace multiplier (1 is plain conversation)' }),
  })

  measure(): LineMeasure {
    return { target: 0, most: 0, grows: false }
  }

  phrases(): Phrase[] {
    return []
  }

  durationSeconds(_tempo: number | null, parameters: Readonly<Record<string, number>>): number {
    const { lines = 2, rate = 0.92 } = this.given(parameters)
    return (lines * 3.5) / rate
  }
}

export default new Spoken()
