// progression-modulated-chorus: see perspective.md
import { pick, turning } from '../lib/facets.js'

export const modulations = [
  { name: 'half step up (+1)', shift: 1 },
  { name: 'whole step up (+2)', shift: 2 },
  { name: 'minor third up (+3)', shift: 3 },
  { name: 'chromatic mediant (+4)', shift: 4 },
  { name: 'fourth up (+5)', shift: 5 },
  { name: 'whole step down (-2)', shift: -2 },
]

export default turning('progression', (setting, { random }) => {
  const chosen = pick(modulations, random)
  return {
    setting: {
      ...setting,
      chorus: { ...setting.chorus, shift: chosen.shift },
    },
    variant: chosen.name,
  }
})
