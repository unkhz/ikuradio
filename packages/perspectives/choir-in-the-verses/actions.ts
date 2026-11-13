// choir-in-the-verses: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('choir', (setting) => ({ setting: { ...setting, verses: true } }))
