import type { Context } from '../../lib/concepts.js'
import { scoreAnswer } from '../../lib/making.js'

/** The Score: sample words fitted to their phrases at a tempo, and the Song's age growing. */
export default ({ records, tempo }: Context) => scoreAnswer(records, tempo, 6)
