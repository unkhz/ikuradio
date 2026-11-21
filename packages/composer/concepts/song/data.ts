import type { Context } from '../../lib/concepts.js'
import { songAnswer } from '../../lib/making.js'

/** The Song: what a Session records, and an Arrangement laid out as its parts would be. */
export default ({ records, arrangementsDir, tempo }: Context) => songAnswer(records, arrangementsDir, tempo)
