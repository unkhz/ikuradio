// verse-wordiness: see tide.md
import { tide } from '../lib/tides.js'

export default tide({
  moves: { facet: 'lyrics', part: 'verse', setting: 'wordiness' },
  age: [3, 5],
  attack: 0.3,
  hold: 0.2,
  decay: 0.3,
  min: 0.3,
  max: 0.9,
})
