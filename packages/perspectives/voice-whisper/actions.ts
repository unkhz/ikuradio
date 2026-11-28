// voice-whisper: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('voice', (setting) => ({
  setting: {
    lead: {
      ...setting.lead,
      ring: 0,
      breathiness: 0.68,
      brightness: 0.28,
      fry: 0.26,
      vibratoDepth: 0.25,
      glide: 0.02,
    },
    harmony: {
      ...setting.harmony,
      ring: 0,
      breathiness: 0.74,
      brightness: 0.24,
      fry: 0.22,
      vibratoDepth: 0.2,
      glide: 0.02,
    },
  },
}))
