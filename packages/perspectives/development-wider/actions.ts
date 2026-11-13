// development-wider: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('development', (setting, { random }) => {
  const ornaments = 2 + Math.floor(random() * 2)
  return { setting: { ...setting, ornaments }, variant: `${ornaments} phrases` }
})
