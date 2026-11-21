import { arrangementsAnswer } from '../../lib/answers.js'
import type { Context } from '../../lib/concepts.js'

/** The Arrangements, with their layouts, as /arrangements.json says them. */
export default ({ records, arrangementsDir, tempo }: Context) => arrangementsAnswer(records, arrangementsDir, tempo)
