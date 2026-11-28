// voice-operatic: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('voice', (setting) => ({
  setting: {
    lead: {
      ...setting.lead,
      ring: 0.85,
      brightness: 0.72,
      breathiness: 0.06,
      vibratoRate: 5.5,
      vibratoDepth: 1.8,
      glide: 0.035,
    },
    harmony: {
      ...setting.harmony,
      ring: 0.62,
      brightness: 0.64,
      breathiness: 0.08,
      vibratoRate: 5.7,
      vibratoDepth: 1.45,
      glide: 0.03,
    },
  },
}))
