// voice-whisper: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('voice', (setting) => ({
  setting: {
    lead: {
      ...setting.lead,
      ring: 0,
      breathiness: 0.72,
      brightness: 0.26,
      vibratoDepth: 0.2,
      glide: 0.02,
    },
    harmony: {
      ...setting.harmony,
      ring: 0,
      breathiness: 0.78,
      brightness: 0.22,
      vibratoDepth: 0.15,
      glide: 0.02,
    },
  },
}))
