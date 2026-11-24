import { Type } from 'typebox'
import { blockParameters } from '../../lib/ranges.js'
import { Track } from '../../lib/track.js'

/**
 * The voice: the lead and the choir, sung by the throat from a Score (or said
 * by the speaking throat for a spoken part). Each Block may choose how many
 * singers join (`solo`, `duet`, `choir`), how they breathe (`plain`, `soft`,
 * `pressed`), and how loosely human they sing (`humanness`).
 */
class Voice extends Track {
  readonly id = 'voice'
  readonly heard = true
  readonly makes = { by: 'the throat', from: 'a Score' }
  readonly parameters = Type.Object({
    ...blockParameters({ gain: 2, fade: 10 }),
    singers: Type.Union([Type.Literal('choir'), Type.Literal('duet'), Type.Literal('solo')], {
      default: 'choir',
      description: 'Who sings this block: the whole choir, a duet, or the lead solo',
    }),
    breath: Type.Union([Type.Literal('plain'), Type.Literal('soft'), Type.Literal('pressed')], {
      default: 'plain',
      description: 'How the voices breathe: plain, soft and airy, or pressed and intense',
    }),
    humanness: Type.Number({
      minimum: 0,
      maximum: 2,
      default: 1,
      description: 'How much human wavering in pitch and timing: 0 steady, 1 usual, 2 loose',
    }),
  })
}

export default new Voice()
