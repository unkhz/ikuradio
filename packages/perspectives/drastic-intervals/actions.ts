// drastic-intervals: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('intervals', (setting, { random }) => {
  const least = 3 + Math.floor(random() * 3)
  const most = Math.max(least, 5 + Math.floor(random() * 8))
  return { setting: { ...setting, leap: [least, most] }, variant: `leaps of ${least} to ${most} whole tones` }
})
