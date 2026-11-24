import { Type } from 'typebox'
import { blockParameters } from '../../lib/ranges.js'
import { Track } from '../../lib/track.js'

/**
 * The drone: a continuous harmonic bed synthesized deterministically from the
 * Song's mode, tonic, and guide chords. Carried as parameters in the Session,
 * never uploaded as audio to the Archive.
 */
class Drone extends Track {
  readonly id = 'drone'
  readonly heard = true
  readonly makes = { by: 'a harmonic drone', from: 'the Song\'s mode and guide chords' }
  readonly parameters = Type.Object({
    ...blockParameters({ gain: 2, fade: 15 }),
    warmth: Type.Number({ minimum: 0, maximum: 1, default: 0.55, description: 'Starting brightness of the drone: 0 dark subterranean hum, 1 luminous' }),
    build: Type.Number({ minimum: 0, maximum: 1, default: 0.55, description: 'Target brightness by the end of the Block — set higher than warmth for a slow harmonic bloom, or lower to fade to embers' }),
    movement: Type.Number({ minimum: 0, maximum: 1, default: 0.4, description: 'How much the harmonics breathe and drift' }),
    octave: Type.Integer({ minimum: -1, maximum: 1, default: 0, description: 'Register shift in octaves: -1 sub-bass, 0 low-mid, 1 pad' }),
  })
}

export default new Drone()
