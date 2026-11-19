export type { Dj, Movements, Voice } from './lib/dj.js'
export { rezzy } from './lib/rezzy.js'
export { requestOf, type Request } from './lib/say.js'
export { chance, dramaOf, wordsOf, type Drama } from './lib/drama.js'
export { movementsOf, openness, type Movement, type Segment } from './lib/movement.js'
import { rezzy } from './lib/rezzy.js'

/** Every DJ there is, by name: loaded once. Rezzy is the only one built. */
export const djs = { rezzy }
