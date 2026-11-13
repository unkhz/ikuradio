// development-deeper: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('development', (setting) => ({ setting: { ...setting, steps: 2 } }))
