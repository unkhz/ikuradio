// The words of a name (plan "The Studio on timelines"): which of the Lyrics' fields a region sings. An Arrangement's names get the words the same names
// have in the Song as it always was (the reference), by name and not by place: a name's field is the one `arrange()` places where the reference first hears it,
// and every hearing of the name sings it. An instance that continues another name sings that name's field. A name the reference does not have has none.

import { arrange, firstLyrics, type Lyrics } from 'song'

/** The Lyrics field each instance sings, or nothing for a name the reference does not have (and a bridge, which has no words). */
export function fieldsOf(instances: readonly { name: string; continues?: string }[], reference: readonly { name: string }[] = instances): (keyof Lyrics | undefined)[] {
  const named = Object.fromEntries((Object.keys(firstLyrics) as (keyof Lyrics)[]).map((field) => [field, field])) as Lyrics
  const sung = arrange(named)
  const byName = new Map(instances.map((instance) => [instance.name, instance]))
  const rootOf = (name: string, seen = new Set<string>()): string => {
    const next = byName.get(name)?.continues
    return next !== undefined && !seen.has(name) ? rootOf(next, seen.add(name)) : name
  }
  const fieldOfName = (name: string): keyof Lyrics | undefined => {
    const first = reference.findIndex((instance) => instance.name === name)
    return first >= 0 && sung[first]?.content ? (sung[first]!.content as keyof Lyrics) : undefined
  }
  return instances.map(({ name }) => fieldOfName(rootOf(name)))
}
