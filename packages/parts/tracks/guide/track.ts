import { Type } from 'typebox'
import { blockParameters } from '../../lib/ranges.js'
import { Track } from '../../lib/track.js'

/** The guide: made and never heard, what a bed grows from. Its Blocks have no gain or fade to give: nothing is heard of them. */
class Guide extends Track {
  readonly id = 'guide'
  readonly heard = false
  readonly makes = { by: 'a hum', from: 'the words and their Score' }
  readonly parameters = Type.Object({})
}

export default new Guide()
