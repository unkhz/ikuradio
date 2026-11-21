// The schemas the Arrangements are checked by, made from the parts the registry found:
// the ids a part may be given, and each part's parameters with their ranges.

import { Type, type TObject, type TSchema } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { readParts, type PartRecord } from './registry.js'

/** The ids of the active parts: what an instance may name. */
export const idsOf = (records: readonly PartRecord[]): string[] => records.filter(({ state }) => state === 'active').map(({ part }) => part.id)

/** The schema of a part id: one of the ids found, and nothing else. */
export function idSchema(records: readonly PartRecord[]): TSchema {
  return Type.Union(idsOf(records).map((id) => Type.Literal(id)), { description: 'The id of a part' })
}

/** The schema of a part's parameters as its instance may set them: any of them, each within its range. */
export function parametersSchema({ part }: PartRecord): TSchema {
  const { properties = {} } = part.parameters as TObject
  return Type.Partial(Type.Object(properties), { additionalProperties: false })
}

/** The schemas of every part's parameters, by id. */
export const parameterSchemas = (records: readonly PartRecord[]): Record<string, TSchema> =>
  Object.fromEntries(records.filter(({ state }) => state === 'active').map((record) => [record.part.id, parametersSchema(record)]))

/** The schemas, made from the parts there are. */
export async function schemas(home?: string) {
  const records = await readParts(home)
  return { id: idSchema(records), parameters: parameterSchemas(records) }
}

/** Whether `value` keeps a part's parameters' ranges: the first thing wrong with it, said plainly, or nothing. */
export function refusal(schema: TSchema, value: unknown): string | undefined {
  const [error] = [...Value.Errors(schema, value)]
  return error ? `${error.path || '/'} ${error.message}` : undefined
}
