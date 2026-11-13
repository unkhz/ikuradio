// bridge-beds-dramatic-percussion: see perspective.md
import { pick, turning } from '../lib/facets.js'

export default turning('bridge-beds', (setting, { random, prompts }) => {
  const kind = pick(prompts, random)
  return { setting: { instead: `${kind}, percussion only, no melody`, melody: true }, variant: kind }
})
