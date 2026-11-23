// An Arrangement as its file is written (plan "Evolution of Song", step 11): its fields in one order, an instance, a tempo change or a
// Block to a line, the rest inline. The editor saves what this says, so that a file made in it and a file written by hand are the same text.

const keyOrder: Record<string, readonly string[]> = {
  arrangement: ['id', 'title', 'instances', 'tempo', 'turns', 'tracks', 'blocks'],
  instance: ['name', 'part', 'parameters', 'seconds', 'continues', 'ending'],
  tempo: ['region', 'hearing', 'bpm'],
  anchor: ['region', 'hearing', 'edge', 'plus'],
  block: ['track', 'key', 'from', 'to', 'source', 'fadeIn', 'fadeOut', 'gain'],
}

const ordered = (value: Record<string, unknown>, kind: string): [string, unknown][] => {
  const order = keyOrder[kind] ?? []
  const known = order.filter((key) => value[key] !== undefined).map((key): [string, unknown] => [key, value[key]])
  return [...known, ...Object.entries(value).filter(([key, v]) => !order.includes(key) && v !== undefined)]
}

/** A value on one line: its object keys in their order, spaced inside braces, as the files have them. */
function inline(value: unknown, kind = ''): string {
  if (Array.isArray(value)) return `[${value.map((item) => inline(item)).join(', ')}]`
  if (value && typeof value === 'object') {
    const nested = kind === 'block' ? { from: 'anchor', to: 'anchor' } : {}
    return `{ ${ordered(value as Record<string, unknown>, kind).map(([key, item]) => `${JSON.stringify(key)}: ${inline(item, (nested as Record<string, string>)[key])}`).join(', ')} }`
  }
  return JSON.stringify(value)
}

/** The text of an Arrangement's file. A list of one change of tempo or one turn is on its line; a longer one, a line to each. */
export function formatArrangement(value: Record<string, unknown>): string {
  const lines = ordered(value, 'arrangement').map(([field, content]) => {
    const kind = ({ instances: 'instance', tempo: 'tempo', turns: 'anchor', blocks: 'block' } as Record<string, string>)[field]
    if (!Array.isArray(content) || !kind) return `  ${JSON.stringify(field)}: ${inline(content)}`
    if (content.length === 0) return `  ${JSON.stringify(field)}: []`
    if (content.length === 1 && (field === 'tempo' || field === 'turns')) return `  ${JSON.stringify(field)}: [${inline(content[0], kind)}]`
    return `  ${JSON.stringify(field)}: [\n${content.map((item) => `    ${inline(item, kind)}`).join(',\n')}\n  ]`
  })
  return `{\n${lines.join(',\n')}\n}\n`
}
