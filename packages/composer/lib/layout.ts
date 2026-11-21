// The layout of an Arrangement (plan "Evolution of Song", step 3): what the diagram draws, as plain numbers.
// Each instance stands where its beats put it, one after the next with no gaps; a part with a fixed length
// lasts that long, and one with phrases lasts as long as its phrases are, at the tune it is laid out at.

import { phraseBeats, type Tune } from 'melody'
import { ending, placesOf, type Arrangement, type Part } from 'parts'

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
  /** How it ends in its place: at home, or open. */
  ending: 'full' | 'half'
  /** The ids of the parts either side of it. */
  before?: string
  after?: string
  /** The other places where these words are heard: the indices of the instances of the same name. */
  heardAgain: number[]
}

export type Layout = { tempo: number; beats: number; seconds: number; instances: Placed[] }

/** The Arrangement laid out along its beats at a tempo, with the parts it names and the tune it is sung to. */
export function layoutOf(arrangement: Arrangement, parts: ReadonlyMap<string, Part>, tune: Tune, tempo: number): Layout {
  const places = placesOf(arrangement, 1n)
  let start = 0
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
      ending: ending(part, place),
      ...(place.before !== undefined ? { before: place.before } : {}),
      ...(place.after !== undefined ? { after: place.after } : {}),
      heardAgain: arrangement.instances.flatMap((other, i) => (i !== index && other.name === name ? [i] : [])),
    }
    start += beats
    return placed
  })
  return { tempo, beats: start, seconds: (start * 60) / tempo, instances }
}
