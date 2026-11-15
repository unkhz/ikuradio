// verse-ceiling: see tide.md
import { tide } from '../lib/tides.js'

export default tide({
  moves: { facet: 'melody', part: 'verse', setting: 'ceiling' },
  age: [3, 6],
  attack: 0.4,
  hold: 0.1,
  decay: 0.3,
  min: 5,
  max: 2,
  noise: 0.2,
  grain: 0.5,
})
