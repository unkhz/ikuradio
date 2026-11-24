// The words of a name (plan "The Studio on timelines"): which of the Lyrics' fields a region sings. An Arrangement's names get the words the same names
// have in the Song as it always was (the reference), by name and not by place: a name's field is the one `arrange()` places where the reference first hears it,
// and every hearing of the name sings it. An instance that continues another name sings that name's field. A name the reference does not have has none.

import { readFileSync } from 'node:fs'
import { arrange, firstLyrics, type Lyrics } from 'song'
import type { Part } from './part.js'

/** The Song as it always was, read once as the canonical reference for mapping region names to Lyrics fields. */
const canonical = (JSON.parse(readFileSync(new URL('../arrangements/the-song/arrangement.json', import.meta.url), 'utf8')) as { instances: { name: string }[] }).instances

/**
 * The Lyrics key each instance sings (or speaks), or undefined for wordless/silent regions.
 * Names shared with `reference` (`the-song`) map to their canonical `Lyrics` fields (`firstVerse`, `chorus`, …);
 * when `parts` is provided, any other region whose Part has `words === 'written' | 'spoken'` maps to its root region name (kept in `lyrics.extra`).
 */
export function fieldsOf(
  instances: readonly { name: string; part?: string; continues?: string }[],
  reference: readonly { name: string }[] = canonical,
  parts?: ReadonlyMap<string, Pick<Part, 'words'>>,
): (string | undefined)[] {
  const named = Object.fromEntries(Object.keys(firstLyrics).map((field) => [field, field])) as unknown as Lyrics
  const sung = arrange(named)
  const byName = new Map<string, { name: string; part?: string; continues?: string }>()
  for (const instance of instances) {
    if (!byName.has(instance.name)) byName.set(instance.name, instance)
  }
  const rootOf = (name: string, start?: string, seen = new Set<string>()): string => {
    const next = start ?? byName.get(name)?.continues
    return next !== undefined && !seen.has(name) ? rootOf(next, undefined, seen.add(name)) : name
  }
  const fieldOfName = (name: string, partId?: string): string | undefined => {
    if (parts && partId) {
      const mode = parts.get(partId)?.words
      if (mode === 'none' || mode === 'silent') return undefined
    }
    const first = reference.findIndex((instance) => instance.name === name)
    if (first >= 0) return sung[first]?.content || undefined
    if (parts && partId) {
      const mode = parts.get(partId)?.words
      if (mode === 'written' || mode === 'spoken') return name
    }
    return undefined
  }
  return instances.map(({ name, part, continues }) => fieldOfName(rootOf(name, continues), part))
}
