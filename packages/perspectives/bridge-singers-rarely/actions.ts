// bridge-singers-rarely: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('bridge-singers', (setting) => ({ setting: { ...setting, humming: 0.15 } }))
