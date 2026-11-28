// voice-chimera: see perspective.md
import { pick, turning } from '../lib/facets.js'

const variants = [
  { name: 'glassy hybrid', vibratoRate: 6.0, vibratoDepth: 0.12, glide: 0.11 },
  { name: 'flutter hybrid', vibratoRate: 7.4, vibratoDepth: 1.55, glide: 0.085 },
] as const

export default turning('voice', (setting, { random }) => {
  const chosen = pick(variants, random)
  return {
    variant: chosen.name,
    setting: {
      lead: {
        ...setting.lead,
        morph: 0.95,
        brightness: 0.85,
        ring: 0.62,
        vibratoRate: chosen.vibratoRate,
        vibratoDepth: chosen.vibratoDepth,
        glide: chosen.glide,
      },
      harmony: {
        ...setting.harmony,
        morph: 0.95,
        brightness: 0.78,
        ring: 0.5,
        vibratoRate: chosen.vibratoRate,
        vibratoDepth: chosen.vibratoDepth * 0.9,
        glide: chosen.glide,
      },
    },
  }
})
