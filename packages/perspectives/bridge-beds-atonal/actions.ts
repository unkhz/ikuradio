// bridge-beds-atonal: see perspective.md
import { pick, turning } from '../lib/facets.js'

export default turning('bridge-beds', (setting, { random, prompts }) => {
  const way = pick(prompts, random)
  return { setting: { instead: way, melody: false }, variant: way }
})
