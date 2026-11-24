import { Type } from 'typebox'
import type { Phrase } from 'melody'
import { Part, type LineMeasure } from '../lib/part.js'
import { melody } from '../lib/ranges.js'

/**
 * The interlude: a variable-length wordless musical section with its own harmonic
 * progression and two-voice guide, letting the band breathe and wander between
 * vocal sections.
 */
class Interlude extends Part {
  readonly id = 'interlude'
  readonly words = 'none'
  readonly ending = 'half'
  readonly parameters = Type.Object({
    bars: Type.Integer({ minimum: 2, maximum: 16, default: 8, description: 'How many four-beat bars the interlude lasts' }),
    ...melody(),
  })

  measure(): LineMeasure {
    return { target: 0, most: 0, grows: false }
  }

  phrases(): Phrase[] {
    return []
  }

  durationSeconds(tempo: number | null, parameters: Readonly<Record<string, number>>): number | undefined {
    if (tempo === null) return undefined
    const { bars = 8 } = this.given(parameters)
    return (bars * 4 * 60) / tempo
  }
}

export default new Interlude()
