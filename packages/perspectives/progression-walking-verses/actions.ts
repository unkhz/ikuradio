// progression-walking-verses: see perspective.md
import { pick, turning } from '../lib/facets.js'

/** The classic walks, by their names, as degrees of whatever mode the Song is in. */
export const walks = [
  { name: 'i-VII-VI-V', roots: [0, 6, 5, 4] },
  { name: 'i-VI-III-VII', roots: [0, 5, 2, 6] },
  { name: 'ii-V-I', roots: [1, 4, 0] },
  { name: 'circle of fifths', roots: [0, 3, 6, 2, 5, 1, 4] },
]

export default turning('progression', (setting, { random }) => {
  const walk = pick(walks, random)
  return {
    setting: { ...setting, verse: { ...setting.verse, style: 'known', known: { from: `classic:${walk.name}`, roots: walk.roots } } },
    variant: walk.name,
  }
})
