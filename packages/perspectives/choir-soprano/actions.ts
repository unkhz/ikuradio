// choir-soprano: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('harmony', (setting) => ({ setting: { ...setting, placement: 'alternating', above: 7 } }))
