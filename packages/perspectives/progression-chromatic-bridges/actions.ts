// progression-chromatic-bridges: see perspective.md
import type { ChromaticFlavor } from 'melody'
import { pick, turning } from '../lib/facets.js'

export const flavors: { name: string; flavor: ChromaticFlavor }[] = [
  { name: 'chromatic approach', flavor: 'approach' },
  { name: 'chromatic descent', flavor: 'descent' },
  { name: 'chromatic climb', flavor: 'climb' },
  { name: 'chromatic roam', flavor: 'roam' },
]

export default turning('progression', (setting, { random }) => {
  const chosen = pick(flavors, random)
  return {
    setting: {
      ...setting,
      bridge: { ...setting.bridge, style: 'chromatic', chromatic: chosen.flavor },
    },
    variant: chosen.name,
  }
})
