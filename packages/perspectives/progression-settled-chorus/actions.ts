// progression-settled-chorus: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('progression', (setting) => ({
  setting: { ...setting, chorus: { ...setting.chorus, temperature: 0.3, pull: 1.2 } },
}))
