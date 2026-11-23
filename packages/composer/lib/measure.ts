// How a part counts its lines for the parameters an instance gives it (plan "Evolution of Song", step 14): the target, the most, and whether a line may
// grow past its bars, for each line of the part at the first tune, asked of the part itself, so that the page that draws them as a slider moves
// repeats no rule of any part. The parameters are checked as an Arrangement checks them.

import { firstTune } from 'melody'
import { parametersSchema, refusal, type PartRecord } from 'parts'

export type LineMeasured = { line: number; target: number; most: number; grows: boolean }
export type Measured = { part: string; words: 'written' | 'none'; lines: LineMeasured[] } | { refusal: string }

/** The measure of every line of a part, at a tempo and a rate, under the parameters given (those not given are the part's own). */
export function measureOf(records: readonly PartRecord[], id: unknown, parameters: unknown, tempo: number, rate = 6): Measured {
  const record = records.find(({ part, state }) => part.id === id && state === 'active')
  if (!record) return { refusal: `there is no part "${String(id)}"` }
  const given = parameters === undefined ? {} : parameters
  const wrong = refusal(parametersSchema(record), given)
  if (wrong) return { refusal: `the parameter ${wrong}` }
  const { part } = record
  if (part.words === 'none') return { part: part.id, words: part.words, lines: [] }
  const place = { iteration: 1n, last: false }
  const count = part.phrases(firstTune, place).length
  return {
    part: part.id,
    words: part.words,
    lines: Array.from({ length: count }, (_, line) => ({ line, ...part.measure({ line, tune: firstTune, tempo, rate, parameters: given as Record<string, number> }) })),
  }
}
