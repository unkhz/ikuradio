// The words of a name (plan "The Studio on timelines"): which of the Lyrics' fields a region sings. An Arrangement's names get the words the same names
// have in the Song as it always was (the reference), by name and not by place: a name's field is the one `arrange()` places where the reference first hears it,
// and every hearing of the name sings it. An instance that continues another name sings that name's field. A name the reference does not have has none.

import { readFileSync } from 'node:fs'
import { arrange, firstLyrics, type Lyrics } from 'song'

/** The Song as it always was, read once as the canonical reference for mapping region names to Lyrics fields. */
const canonical = (JSON.parse(readFileSync(new URL('../arrangements/the-song/arrangement.json', import.meta.url), 'utf8')) as { instances: { name: string }[] }).instances

/** The Lyrics field each instance sings, or nothing for a name the reference does not have (and a bridge, which has no words). */
export function fieldsOf(instances: readonly { name: string; continues?: string }[], reference: readonly { name: string }[] = canonical): (keyof Lyrics | undefined)[] {
  const named = Object.fromEntries((Object.keys(firstLyrics) as (keyof Lyrics)[]).map((field) => [field, field])) as Lyrics
  const sung = arrange(named)
  const byName = new Map<string, { name: string; continues?: string }>()
  for (const instance of instances) {
    if (!byName.has(instance.name)) byName.set(instance.name, instance)
  }
  const rootOf = (name: string, start?: string, seen = new Set<string>()): string => {
    const next = start ?? byName.get(name)?.continues
    return next !== undefined && !seen.has(name) ? rootOf(next, undefined, seen.add(name)) : name
  }
  const fieldOfName = (name: string): keyof Lyrics | undefined => {
    const first = reference.findIndex((instance) => instance.name === name)
    return first >= 0 && sung[first]?.content ? (sung[first]!.content as keyof Lyrics) : undefined
  }
  return instances.map(({ name, continues }) => fieldOfName(rootOf(name, continues)))
}
