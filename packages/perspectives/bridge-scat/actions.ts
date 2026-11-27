// bridge-scat: see perspective.md
import { pick, turning } from '../lib/facets.js'

export default turning('bridge-voice', (setting, { random, prompts }) => {
  const entry = pick(prompts, random)
  const sep = entry.indexOf(': ')
  const tokens = (sep >= 0 ? entry.slice(sep + 2) : entry).trim().split(/\s+/)
  return { setting: { ...setting, syllables: tokens }, variant: entry }
})
