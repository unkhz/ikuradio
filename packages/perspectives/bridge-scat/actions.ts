// bridge-scat: see perspective.md
import { pick, turning } from '../lib/facets.js'

export default turning('bridge-voice', (setting, { random, prompts }) => {
  const set = pick(prompts, random)
  return { setting: { ...setting, syllables: set.split(' ') }, variant: set }
})
