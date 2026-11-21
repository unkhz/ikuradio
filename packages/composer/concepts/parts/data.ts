import { partsAnswer } from '../../lib/answers.js'
import type { Context } from '../../lib/concepts.js'

/** The parts, as /parts.json has always said them. */
export default ({ records }: Context) => partsAnswer(records)
