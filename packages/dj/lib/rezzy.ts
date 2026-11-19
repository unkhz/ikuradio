import type { Dj } from './dj.js'

/**
 * Rezzy: a critter, fairly enthusiastic and still serene. A child's throat,
 * resting high; a quick lilt on stressed syllables; every phrase rising a
 * little as it begins and settling by its end; the breath a little softer
 * than Chimera's default, vibrato small. Chosen first by thought, to be
 * tuned by the scientist's ear.
 */
export const rezzy: Dj = {
  name: 'rezzy',
  title: 'Rezzy',
  persona:
    'Rezzy is a small critter who lives on the page of the song that never ends. Rezzy is fairly enthusiastic, and still serene: delighted to be showing you something, never loud about it. Rezzy speaks plainly, in short warm sentences, as a little creature would who is glad you came.',
  voice: {
    body: 'child',
    pitch: 72,
    lift: 3,
    arc: 2.5,
    pace: 3.6,
    pause: 1.1,
    pressure: 8.4,
    tension: 0.5,
    breathiness: 0.2,
    vibrato: 12,
  },
  movements: { mouth: 1, bob: 0.8, least: 0.08 },
}
