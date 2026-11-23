import { Type } from 'typebox'
import { blockParameters } from '../../lib/ranges.js'
import { Track } from '../../lib/track.js'

/** The bed: an instrument grown by MusicGen from a hummed guide, reaching past its part and fading under the next. It is heard. */
class Bed extends Track {
  readonly id = 'bed'
  readonly heard = true
  readonly makes = { by: 'MusicGen', from: 'a hummed guide' }
  readonly parameters = Type.Object(blockParameters({ gain: 2, fade: 30 }))
}

export default new Bed()
