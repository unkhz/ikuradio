import type { Context } from '../../lib/concepts.js'
import { lyricsAnswer } from '../../lib/making.js'

/** The Lyrics: its fields, where they are sung, each line's count at a tempo, the Song's age. */
export default ({ records, arrangementsDir, tempo }: Context) => lyricsAnswer(records, arrangementsDir, tempo)
