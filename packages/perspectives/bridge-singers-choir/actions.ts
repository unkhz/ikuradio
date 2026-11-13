// bridge-singers-choir: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('bridge-singers', (setting) => ({ setting: { ...setting, choir: true } }))
