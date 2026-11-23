// An Arrangement (plan "Evolution of Song", step 2): which parts a Song is made of, in what order, and
// the parameters each is given. A JSON declaration, checked by a schema made from the parts the registry
// found, so a declaration naming a part that does not exist, or a parameter outside its part's range, is
// refused before anything is made. It lists every instance, in order, bridges included: nothing is
// inserted by a rule. Instances with the same name sing the same words, so they must be the same part.

import { Type, type Static, type TSchema } from 'typebox'
import { Value } from 'typebox/value'
import { Part, type Place } from './part.js'
import type { PartRecord } from './registry.js'
import { idSchema, parametersSchema, refusal } from './schema.js'
import { refuseTimeline, timelineShape, type Timeline } from './timeline.js'
import type { TrackRecord } from './tracks.js'

/** A name: lowercase words and digits joined by hyphens, as slugs are. */
const named = (description: string) => Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', description })

/** One part in an Arrangement, a region of its timeline: its name, its identity within it; the part it is; the parameters it sets, if any; its seconds, if it is in free time. */
export type Instance = { name: string; part: string; parameters?: Record<string, number>; seconds?: number }

/** What an Arrangement says: its regions, and, by addition, its tempo map, its tracks and the blocks on them. */
export type Arrangement = { id: string; title: string; instances: Instance[] } & Timeline

/** The schema of an Arrangement, made from the parts there are: an instance is of one of them, and sets only its parameters, each in its range. */
export function arrangementSchema(records: readonly PartRecord[], tracks: readonly TrackRecord[] = []): TSchema {
  const active = records.filter(({ state }) => state === 'active')
  const instance = Type.Union(
    active.map((record) =>
      Type.Object(
        { name: named('The instance'), part: Type.Literal(record.part.id), parameters: Type.Optional(parametersSchema(record)), seconds: Type.Optional(Type.Number({ exclusiveMinimum: 0 })) },
        { additionalProperties: false },
      ),
    ),
  )
  return Type.Object(
    { id: named('The Arrangement'), title: Type.String({ minLength: 1 }), instances: Type.Array(instance, { minItems: 1 }), ...timelineShape(tracks.filter(({ state }) => state === 'active').map(({ track }) => track.id)) },
    { additionalProperties: false },
  )
}

/** The shape of an Arrangement, with the part an instance names and the parameters it sets left to be checked by that part. */
const shape = (records: readonly PartRecord[]) =>
  Type.Object(
    {
      id: named('The Arrangement'),
      title: Type.String({ minLength: 1 }),
      instances: Type.Array(
        Type.Object({ name: named('The instance'), part: idSchema(records), parameters: Type.Optional(Type.Record(Type.String(), Type.Unknown())), seconds: Type.Optional(Type.Number({ exclusiveMinimum: 0 })) }, { additionalProperties: false }),
        { minItems: 1 },
      ),
      ...timelineShape(),
    },
    { additionalProperties: false },
  )

/** The first thing wrong with a declaration, said plainly, or nothing if it is an Arrangement. */
export function refuseArrangement(value: unknown, records: readonly PartRecord[], tracks: readonly TrackRecord[] = []): string | undefined {
  const wrong = refusal(shape(records), value)
  if (wrong) return wrong
  const { instances } = value as Arrangement
  const byId = new Map(records.filter(({ state }) => state === 'active').map((record) => [record.part.id, record]))
  const seen = new Map<string, string>()
  for (const [i, { name, part, parameters }] of instances.entries()) {
    const where = `instance ${i + 1} ("${name}", a ${part})`
    const problem = parameters && refusal(parametersSchema(byId.get(part)!), parameters)
    if (problem) return `${where}: the parameter ${problem}`
    const before = seen.get(name)
    // instances with one name sing the same words: they can only be one part
    if (before !== undefined && before !== part) return `${where}: the name "${name}" is already a ${before}; one name, one part`
    seen.set(name, part)
  }
  // and the timeline, if it has one: its tempo, its free time, its blocks
  return refuseTimeline(value as Arrangement, new Map([...byId].map(([id, record]) => [id, record.part])), tracks)
}

/** Whether `value` is an Arrangement of these parts, by the whole schema: what `refuseArrangement` says, said by the schema. */
export const isArrangement = (value: unknown, records: readonly PartRecord[], tracks: readonly TrackRecord[] = []): value is Arrangement => Value.Check(arrangementSchema(records, tracks), value)

/** The Static type of an Arrangement's schema, for those who want it. */
export type ArrangementOf = Static<ReturnType<typeof arrangementSchema>>

/** Each instance's place in the Arrangement, for an iteration: its neighbours, and whether it is the last. */
export function placesOf(arrangement: Arrangement, iteration: bigint): Place[] {
  const { instances } = arrangement
  return instances.map((_, i) => ({
    iteration,
    last: i === instances.length - 1,
    ...(i > 0 ? { before: instances[i - 1]!.part } : {}),
    ...(i < instances.length - 1 ? { after: instances[i + 1]!.part } : {}),
  }))
}

/** How a part ends in its place: at home if it is the last, else as the part says. That is how a place says otherwise. */
export const ending = (part: Part, place: Place): 'full' | 'half' => (place.last ? 'full' : part.ending)
