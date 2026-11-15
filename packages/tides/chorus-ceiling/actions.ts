// chorus-ceiling: see tide.md
import { tide } from '../lib/tides.js'

export default tide({
  moves: { facet: 'melody', part: 'chorus', setting: 'ceiling' },
  age: [4, 6],
  attack: 0.3,
  hold: 0.2,
  decay: 0.3,
  min: 3,
  max: 0,
  noise: 0.15,
  grain: 1,
})
