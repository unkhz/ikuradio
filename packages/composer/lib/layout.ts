// The layout of an Arrangement (plan "Evolution of Song", step 3): what the diagram draws, as plain numbers.
// Each instance stands where its beats put it, one after the next with no gaps; a part with a fixed length
// lasts that long, and one with phrases lasts as long as its phrases are, at the tune it is laid out at.

import { phraseBeats, type Tune } from 'melody'
import { ending, iterationsOf, placesOf, type Arrangement, type Part } from 'parts'

/** One instance, as drawn. */
export type Placed = {
  index: number
  name: string
  part: string
  /** Where it begins, in beats from the start. */
  start: number
  /** How long it lasts, in beats. */
  beats: number
  /** The same, in seconds, at the tempo. */
  startSeconds: number
  seconds: number
  /** Whether it has words, written by the mind, or none. */
  words: 'written' | 'none'
  /** Whether a line of it may grow past its bars, with the Song's age. */
  grows: boolean
  /** How it ends in its place: at home, or open. */
  ending: 'full' | 'half'
  /** The ids of the parts either side of it. */
  before?: string
  after?: string
  /** The iteration it is sung in, from 0: the words turn over at each turn. */
  iteration: number
  /** The other places where these very words are heard: the instances of the same name within its iteration. */
  heardAgain: number[]
  /** Where its words are taken up from, if it follows words sung before: the instance its `continues` names, or the same name in the iteration before a turn. */
  continues?: number
}

export type Layout = { tempo: number; beats: number; seconds: number; instances: Placed[] }

/** Syllables a second the tune is counted at, as the Studio's usual rate: only the growing of a line is asked of it here. */
const usualRate = 6
/** Whether any line of a part may grow past its bars. */
const growsOf = (part: Part, lines: number, tune: Tune, tempo: number): boolean =>
  Array.from({ length: lines }, (_, line) => line).some((line) => part.measure({ line, tune, tempo, rate: usualRate, parameters: {} }).grows)

/** The Arrangement laid out along its beats at a tempo, with the parts it names and the tune it is sung to. */
export function layoutOf(arrangement: Arrangement, parts: ReadonlyMap<string, Part>, tune: Tune, tempo: number): Layout {
  const places = placesOf(arrangement, 1n)
  const iterations = iterationsOf(arrangement.instances, arrangement.turns)
  /** The nearest instance before `index` of a name, in an earlier iteration. */
  const before = (index: number, name: string) => arrangement.instances.findLastIndex((other, i) => i < index && other.name === name && iterations[i]! < iterations[index]!)
  let start = 0
  const continuation = (index: number, name: string): { continues?: number } => {
    const said = arrangement.instances[index]!.continues
    const from = said !== undefined ? arrangement.instances.findLastIndex((other, i) => i < index && other.name === said) : before(index, name)
    return from >= 0 ? { continues: from } : {}
  }
  const instances = arrangement.instances.map(({ name, part: id }, index): Placed => {
    const part = parts.get(id)
    if (!part) throw new Error(`instance ${index + 1} ("${name}"): there is no part "${id}"`)
    const place = places[index]!
    const beats = part.beats ?? part.phrases(tune, place).reduce((sum, phrase) => sum + phraseBeats(phrase), 0)
    const placed: Placed = {
      index,
      name,
      part: id,
      start,
      beats,
      startSeconds: (start * 60) / tempo,
      seconds: (beats * 60) / tempo,
      words: part.words,
      grows: growsOf(part, part.phrases(tune, place).length, tune, tempo),
      ending: ending(part, place),
      ...(place.before !== undefined ? { before: place.before } : {}),
      ...(place.after !== undefined ? { after: place.after } : {}),
      iteration: iterations[index]!,
      heardAgain: arrangement.instances.flatMap((other, i) => (i !== index && other.name === name && iterations[i] === iterations[index] ? [i] : [])),
      ...continuation(index, name),
    }
    start += beats
    return placed
  })
  return { tempo, beats: start, seconds: (start * 60) / tempo, instances }
}
