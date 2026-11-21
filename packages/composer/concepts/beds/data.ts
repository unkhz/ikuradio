import type { Context } from '../../lib/concepts.js'
import { bedsAnswer } from '../../lib/making.js'

/** The Beds: the kinds an Arrangement asks for, and the guide a section's lines make. */
export default ({ records, arrangementsDir, tempo }: Context) => bedsAnswer(records, arrangementsDir, tempo)
