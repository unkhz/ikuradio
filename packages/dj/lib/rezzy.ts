import type { Dj } from './dj.js'

/**
 * Rezzy: a critter, fairly enthusiastic and still serene, and a young
 * anime character to the ear, androgynous: a body between male and female,
 * resting high, a little quick, leaning on stressed syllables more than
 * Chimera does. The rest of the throat is Chimera's own. Tuned by the
 * scientist's ear: this is the first option of c to h, heard as `c`.
 */
export const rezzy: Dj = {
  name: 'rezzy',
  title: 'Rezzy',
  persona:
    'Rezzy is a small critter who lives on the page of the song that never ends, bright and young in manner. Rezzy is fairly enthusiastic, and still serene: delighted to be showing you something, never loud about it. Rezzy speaks plainly, in short warm sentences, as a lively young creature would who is glad you came.',
  voice: { body: { female: 0.6, child: 0 }, f0: 265, rate: 1.1, accent: 0.2 },
  movements: { mouth: 1, bob: 0.8, least: 0.08 },
}
