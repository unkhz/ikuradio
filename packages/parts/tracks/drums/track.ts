import { Type } from 'typebox'
import { blockParameters } from '../../lib/ranges.js'
import { Track } from '../../lib/track.js'

/**
 * The drums: a dedicated hypnotic tribal, slow-trance, or ritual percussion
 * Track locked to the tempo map (silent in free time). Supports an evolving
 * `intensity` → `build` arc across the Block so a long buildup gradually layers
 * frame drums, syncopated toms, shakers, and rolling tension before a drop.
 */
class Drums extends Track {
  readonly id = 'drums'
  readonly heard = true
  readonly makes = { by: 'tribal or slow-trance percussion', from: 'the tempo map and mode' }
  readonly parameters = Type.Object({
    ...blockParameters({ gain: 2, fade: 15 }),
    style: Type.Union([Type.Literal('tribal'), Type.Literal('trance'), Type.Literal('ritual')], {
      default: 'tribal',
      description: 'Percussion character: tribal frame-drums & toms, hypnotic slow-trance, or cavernous ritual',
    }),
    intensity: Type.Number({
      minimum: 0,
      maximum: 1,
      default: 0.5,
      description: 'Starting energy and layer density at the beginning of the Block (0 sparse heartbeat, 1 full drive)',
    }),
    build: Type.Number({
      minimum: 0,
      maximum: 1,
      default: 0.5,
      description: 'Target energy by the end of the Block — raise above intensity for a long evolving crescendo, or lower to unwind',
    }),
    swing: Type.Number({ minimum: 0, maximum: 0.4, default: 0.08, description: 'Organic off-beat swing' }),
    halfTime: Type.Integer({ minimum: 0, maximum: 1, default: 0, description: '1 plays at half-time feel for heavy, cavernous weight' }),
  })
}

export default new Drums()
