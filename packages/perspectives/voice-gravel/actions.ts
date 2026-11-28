// voice-gravel: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('voice', (setting) => ({
  setting: {
    lead: {
      ...setting.lead,
      roughness: 0.74,
      fry: 0.48,
      growl: 0.52,
      ring: 0.48,
      brightness: 0.62,
      breathiness: 0.1,
      vibratoDepth: 0.65,
    },
    harmony: {
      ...setting.harmony,
      roughness: 0.46,
      fry: 0.3,
      growl: 0.3,
      ring: 0.32,
      brightness: 0.54,
      breathiness: 0.12,
      vibratoDepth: 0.6,
    },
  },
}))
