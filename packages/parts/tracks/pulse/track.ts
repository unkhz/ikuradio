import { Type } from 'typebox'
import { blockParameters } from '../../lib/ranges.js'
import { Track } from '../../lib/track.js'

/**
 * The pulse: a quiet, organic pitched rhythm locked to the Song's tempo map and
 * mode, falling silent in free time. Carried as parameters in the Session, never
 * uploaded as audio to the Archive.
 */
class Pulse extends Track {
  readonly id = 'pulse'
  readonly heard = true
  readonly makes = { by: 'a quiet pulse', from: 'the tempo map and mode' }
  readonly parameters = Type.Object({
    ...blockParameters({ gain: 2, fade: 10 }),
    density: Type.Number({ minimum: 0, maximum: 1, default: 0.5, description: 'From sparse downbeat heartbeat (0) to steady subdivided pulse (1)' }),
    swing: Type.Number({ minimum: 0, maximum: 0.5, default: 0, description: 'How far off-beats lean late' }),
    tone: Type.Number({ minimum: 0, maximum: 1, default: 0.45, description: 'From warm muted thump (0) to crisp woody tap (1)' }),
  })
}

export default new Pulse()
