// progression-chorus-homecoming: see perspective.md
import { turning } from '../lib/facets.js'

// the part sings one of a critic's favourite moments' chords; the Studio finds them
export default turning('progression', (setting) => ({
  setting: { ...setting, chorus: { ...setting.chorus, style: 'known', known: { from: 'scientist' } } },
}))
