import { Type } from 'typebox'
import type { Phrase } from 'melody'
import { Part, type LineMeasure } from '../lib/part.js'

/**
 * The silence: a deliberate quiet breath between sections, holding stillness for
 * a chosen number of seconds with no words, no voice, and no bed required.
 */
class Silence extends Part {
  readonly id = 'silence'
  readonly words = 'silent'
  readonly ending = 'half'
  readonly parameters = Type.Object({
    seconds: Type.Number({ minimum: 1, maximum: 12, default: 4, description: 'How many seconds of quiet breath the silence holds' }),
  })

  measure(): LineMeasure {
    return { target: 0, most: 0, grows: false }
  }

  phrases(): Phrase[] {
    return []
  }

  durationSeconds(_tempo: number | null, parameters: Readonly<Record<string, number>>): number {
    return this.given(parameters).seconds ?? 4
  }
}

export default new Silence()
