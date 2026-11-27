// progression-tonicized-verses: see perspective.md
import { pick, turning } from '../lib/facets.js'

export const targets = [
  { name: 'minor third (+3)', target: 3 },
  { name: 'chromatic mediant (+4)', target: 4 },
  { name: 'subdominant (+5)', target: 5 },
  { name: 'dominant (+7)', target: 7 },
  { name: 'flat sixth (+8)', target: 8 },
  { name: 'neapolitan (+1)', target: 1 },
]

export default turning('progression', (setting, { random }) => {
  const chosen = pick(targets, random)
  return {
    setting: {
      ...setting,
      verse: { ...setting.verse, style: 'tonicize', target: chosen.target },
    },
    variant: chosen.name,
  }
})
