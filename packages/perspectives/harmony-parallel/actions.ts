// harmony-parallel: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('harmony', (setting) => ({ setting: { ...setting, style: 'parallel' } }))
