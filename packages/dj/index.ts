export type { Dj, Movements, Voice } from './lib/dj.js'
export { rezzy } from './lib/rezzy.js'
export { breath, guessed, lasts, shortest, speak, speechBpm, spokenOf, taken, type Speech, type Spoken, type Take } from './lib/speech.js'
export { movementsOf, type Movement } from './lib/movement.js'
import { rezzy } from './lib/rezzy.js'

/** Every DJ there is, by name: loaded once. Rezzy is the only one built. */
export const djs = { rezzy }
