// bridge-beds-atonal: see perspective.md
import { rowName, toneRow } from 'melody'
import { turning } from '../lib/facets.js'

export default turning('bridge-beds', (setting, { random }) => {
  const row = toneRow(random)
  return { setting: { ...setting, melody: true, row }, variant: `a row of twelve: ${rowName(row)}` }
})
