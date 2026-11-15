// chorus-wordiness: see tide.md
import { tide } from '../lib/tides.js'

export default tide({
  moves: { facet: 'lyrics', part: 'chorus', setting: 'wordiness' },
  age: [4, 6],
  attack: 0.4,
  hold: 0.1,
  decay: 0.4,
  min: 0.4,
  max: 0.9,
})
