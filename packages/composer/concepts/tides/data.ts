import type { Context } from '../../lib/concepts.js'
import { tidesAnswer } from '../../lib/shaping.js'

/** The Song the Tides' positions are marked at: `?song=`, else COMPOSER_SONG (the Song now), else the first. */
const songOf = (query: URLSearchParams) => {
  const asked = Number(query.get('song') ?? process.env.COMPOSER_SONG ?? 1)
  return Number.isFinite(asked) && asked >= 1 && asked <= 1e9 ? Math.floor(asked) : 1
}

/** Every Tide with its envelope drawn as a curve around that Song. */
export default ({ query }: Context) => tidesAnswer(songOf(query))
