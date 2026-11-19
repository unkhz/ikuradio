import type { Dj } from './dj.js'

/**
 * Rezzy, who is they/them: a critter, fairly enthusiastic and still serene, and a young
 * anime character to the ear, androgynous: a body between male and female,
 * resting high, a little quick, leaning on stressed syllables more than
 * Chimera does. The rest of the throat is Chimera's own. Tuned by the
 * scientist's ear: first option `c` (f0 265), then lower, nearer sixteen
 * than thirteen (f0 232, the body half way between male and female, a
 * touch of child left). Like a DJ, Rezzy draws a word out now and then, for
 * effect: about one in nine, held one and a half to twice as long.
 */
export const rezzy: Dj = {
  name: 'rezzy',
  title: 'Rezzy',
  persona:
    'Rezzy is a small critter who lives on the page of the song that never ends, bright and young in manner. Rezzy is they/them. Rezzy is fairly enthusiastic, and still serene: delighted to be showing you something, never loud about it. Rezzy speaks plainly, in short warm sentences, as a lively young creature would who is glad you came.',
  voice: { body: { female: 0.5, child: 0.05 }, f0: 232, rate: 1.1, accent: 0.2, drama: { every: 9, most: 3, factor: [1.5, 2] } },
  movements: { mouth: 1, bob: 0.8, least: 0.08 },
}
