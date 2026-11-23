// What a refusal is about, as a thing in the draft (plan "Evolution of Song", step 12): the server says it in its own words, and the page shows
// it on the thing, the instance, the Block, the field. The words are the package's: a refusal begins by naming what it is about ("block 3
// (...)", "tempo change 2: ...", "turn 1: ...", "region 4 (...)"), or is a schema's, which begins with a path ("/blocks/4/from/edge ..."). Both are read here, once,
// and the page is told which thing and which of them, from 0.

export type Where = { thing: 'arrangement' | 'instance' | 'tempo' | 'turn' | 'block' | 'track'; index?: number; field?: string }

const named: Record<string, Where['thing']> = { instance: 'instance', region: 'instance', block: 'block', turn: 'turn', 'tempo change': 'tempo' }
const paths: Record<string, Where['thing']> = { instances: 'instance', blocks: 'block', turns: 'turn', tempo: 'tempo' }

/** The thing a refusal is about, or nothing if it is about the Arrangement as a whole. */
export function whereOf(refusal: string): Where | undefined {
  const said = /^(instance|region|block|turn|tempo change) (\d+)\b/.exec(refusal)
  if (said) return { thing: named[said[1]!]!, index: Number(said[2]) - 1 }
  const path = /^\/(instances|blocks|turns|tempo)\/(\d+)(?:\/([A-Za-z]+))?/.exec(refusal)
  if (path) return { thing: paths[path[1]!]!, index: Number(path[2]), ...(path[3] ? { field: path[3] } : {}) }
  const top = /^\/(id|title|tracks)\b/.exec(refusal)
  if (top) return { thing: 'arrangement', field: top[1]! }
  if (/^the Arrangement names the track/.test(refusal)) return { thing: 'arrangement', field: 'tracks' }
  return undefined
}
