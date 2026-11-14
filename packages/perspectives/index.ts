// Perspectives: the ways a Song may be heard differently from the usual.
// Each one lives in a folder of its own here: its arkku record
// (perspective.md: its Facet, weight and state), its Turn (actions.ts), and
// words for a model if the Turn needs any (prompts.json).
// See plans/2026-11-13-perspectives.md.

export {
  defaults,
  facets,
  parts,
  pick,
  turning,
  type Actions,
  type Facet,
  type Part,
  type Settings,
  type Turn,
  type TurnContext,
  type Turned,
} from './lib/facets.js'
export {
  describePerspectives,
  clash,
  draw,
  howMany,
  perspectiveOdds,
  parseRecord,
  perspectivesFor,
  perspectivesHome,
  readPerspectives,
  resolve,
  type Chosen,
  type PerspectiveRecord,
} from './lib/choose.js'
