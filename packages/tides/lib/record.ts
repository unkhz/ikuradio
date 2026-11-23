// A Tide as the editor works it (plan "Evolution of Song", step 14): its record (tide.md) and its envelope (the object its actions.ts hands
// to `tide`), checked by the rules the package keeps, and written as the files are written, so that files made in the Composer and files
// written by hand are the same text. A Tide's envelope is plain data, which is why it can be edited; a Tide's moves are one of those a Setting allows.

import type { TideRecord, Tide } from './tides.js'
import { checkEnvelope, checkNoise, validRange } from './tides.js'

/** A Tide, all of it: its record's fields and words, what it moves, and its envelope. */
export type TideFile = { slug: string; id: number; state: string; body: string } & Tide

/** What a Tide may move: the parts of each Facet, and the settings of each. */
export const movable = {
  melody: { parts: ['verse', 'chorus', 'bridge'], settings: ['ceiling', 'span', 'travel'] },
  lyrics: { parts: ['verse', 'chorus'], settings: ['wordiness'] },
} as const

/** The fields of a tide.md, as its frontmatter and its body say them, with the envelope its actions.ts hands over. */
export function fileOf(text: string, definition: Tide): TideFile {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) throw new Error('a Tide record begins with frontmatter')
  const fields = Object.fromEntries(
    match[1]!.split('\n').flatMap((line) => {
      const at = line.indexOf(':')
      return at > 0 ? [[line.slice(0, at).trim(), line.slice(at + 1).trim()]] : []
    }),
  )
  const { moves, age, attack, hold, decay, min, max, noise, grain } = definition
  return { slug: fields.slug ?? '', id: Number(fields.id), state: fields.state ?? '', body: text.slice(match[0].length), moves, age: [age[0], age[1]], attack, hold, decay, min, max, ...(noise !== undefined ? { noise } : {}), ...(grain !== undefined ? { grain } : {}) }
}

/** The text of a tide.md: its frontmatter in the order the files keep it, and its words as they are. */
export function formatTideRecord(file: TideFile): string {
  return `---\nstate: ${file.state}\nid: ${file.id}\nkind: tide\nslug: ${file.slug}\n---\n${file.body}`
}

/** The text of an actions.ts: what the Tide moves, and its envelope, a field to a line. */
export function formatTideActions(file: TideFile): string {
  const { moves } = file
  const lines = [
    `  moves: { facet: '${moves.facet}', part: '${moves.part}', setting: '${moves.setting}' },`,
    `  age: [${file.age[0]}, ${file.age[1]}],`,
    `  attack: ${file.attack},`,
    `  hold: ${file.hold},`,
    `  decay: ${file.decay},`,
    `  min: ${file.min},`,
    `  max: ${file.max},`,
    ...(file.noise !== undefined ? [`  noise: ${file.noise},`] : []),
    ...(file.grain !== undefined ? [`  grain: ${file.grain},`] : []),
  ]
  return `// ${file.slug}: see tide.md\nimport { tide } from '../lib/tides.js'\n\nexport default tide({\n${lines.join('\n')}\n})\n`
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/**
 * The first thing wrong with a Tide, as "field: what is wrong", or nothing: the package's own rules for an envelope and its wandering, what it moves,
 * its rest and peak within what its setting can be, and never two active Tides on one setting of one part (`others` are the other Tides there are).
 */
export function refuseTide(file: TideFile, others: readonly Pick<TideRecord, 'slug' | 'state' | 'moves'>[] = []): string | undefined {
  if (typeof file !== 'object' || file === null) return 'a Tide is a record'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(file.slug ?? '')) return 'slug: lowercase words and digits joined by hyphens'
  if (!Number.isInteger(file.id) || file.id < 1) return 'id: a whole number from 1'
  if (!['draft', 'active', 'retired'].includes(file.state)) return 'state: it is one of draft, active, retired'
  const moves = file.moves
  const kind = moves && (movable as Record<string, { parts: readonly string[]; settings: readonly string[] }>)[moves.facet]
  if (!kind) return `moves: a Tide moves ${Object.keys(movable).join(' or ')}`
  if (!kind.parts.includes(moves.part)) return `moves: the ${moves.facet} Facet has the parts ${kind.parts.join(', ')}`
  if (!kind.settings.includes(moves.setting)) return `moves: the ${moves.facet} Facet has the settings ${kind.settings.join(', ')}`
  if (!Array.isArray(file.age) || file.age.length !== 2 || !file.age.every(finite)) return 'age: a range of two numbers of Songs'
  for (const field of ['attack', 'hold', 'decay', 'min', 'max'] as const) if (!finite(file[field])) return `${field}: a number`
  if (file.noise !== undefined && !finite(file.noise)) return 'noise: a number'
  if (file.grain !== undefined && !finite(file.grain)) return 'grain: a number'
  try {
    checkEnvelope(file.slug, file)
    checkNoise(file.slug, file)
  } catch (error) {
    const said = (error as Error).message.slice(file.slug.length + 2)
    const field = /attack, hold and decay/.test(said) ? 'attack' : /^an age/.test(said) ? 'age' : /^noise/.test(said) ? 'noise' : /^grain/.test(said) ? 'grain' : 'min'
    return `${field}: ${said}`
  }
  const [lo, hi] = validRange[moves.setting as keyof typeof validRange]
  for (const field of ['min', 'max'] as const) if (file[field] < lo || file[field] > hi) return `${field}: the ${moves.setting} can be ${lo} to ${hi}`
  if (file.state === 'active') {
    const twin = others.find((other) => other.slug !== file.slug && other.state === 'active' && other.moves.facet === moves.facet && other.moves.part === moves.part && other.moves.setting === moves.setting)
    if (twin) return `moves: ${twin.slug} already moves the ${moves.setting} of the ${moves.part}: one Tide a setting a part`
  }
  return undefined
}
