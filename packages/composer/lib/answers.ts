// What the Composer says of the parts and of the Arrangements, as JSON: for its own routes and for the pages of the
// concepts that are those (see concepts/parts and concepts/arrangement).

import { firstTune } from 'melody'
import { readArrangements, readTracks, type PartRecord, type TrackRecord } from 'parts'
import { layoutOf } from './layout.js'
import { timelineOf } from './timeline.js'

type Parameter = { name: string; minimum?: number; maximum?: number; default?: number; description?: string }

/** A part's parameters, with their ranges, defaults and words, read from its schema. */
function parametersOf({ part }: PartRecord): Parameter[] {
  const { properties = {} } = part.parameters as { properties?: Record<string, Omit<Parameter, 'name'>> }
  return Object.entries(properties).map(([name, { minimum, maximum, default: given, description }]) => ({
    name,
    ...(minimum !== undefined ? { minimum } : {}),
    ...(maximum !== undefined ? { maximum } : {}),
    ...(given !== undefined ? { default: given } : {}),
    ...(description !== undefined ? { description } : {}),
  }))
}

/** Every part, with its record, what it is, and its parameters. */
export const partsAnswer = (records: readonly PartRecord[]) =>
  records.map((record) => ({
    id: record.part.id,
    title: record.title,
    text: record.text,
    state: record.state,
    words: record.part.words,
    ending: record.part.ending,
    ...(record.part.beats !== undefined ? { beats: record.part.beats } : {}),
    parameters: parametersOf(record),
  }))

/** Every Arrangement, with its declaration, its layout at the first tune and a tempo, and its timeline resolved at them. */
export async function arrangementsAnswer(records: readonly PartRecord[], arrangementsDir: string, tempo: number, tracks?: readonly TrackRecord[]) {
  const parts = new Map(records.map(({ part }) => [part.id, part]))
  const lanes = tracks ?? (await readTracks())
  return (await readArrangements(records, arrangementsDir, lanes)).map(({ arrangement, title, text, state }) => {
    const layout = layoutOf(arrangement, parts, firstTune, tempo)
    return { id: arrangement.id, title, text, state, declaration: arrangement, layout, timeline: timelineOf(arrangement, layout, lanes, tempo) }
  })
}
