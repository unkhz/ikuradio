// verse-unfamiliar-melody: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('verse-tune', (setting) => ({ setting: { ...setting, unfamiliar: true } }))
