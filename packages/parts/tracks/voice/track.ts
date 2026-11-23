import { Type } from 'typebox'
import { blockParameters } from '../../lib/ranges.js'
import { Track } from '../../lib/track.js'

/** The voice: the lead and the choir, sung by the throat from a Score. It is heard. */
class Voice extends Track {
  readonly id = 'voice'
  readonly heard = true
  readonly makes = { by: 'the throat', from: 'a Score' }
  readonly parameters = Type.Object(blockParameters({ gain: 2, fade: 10 }))
}

export default new Voice()
