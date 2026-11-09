import { ask } from 'tools'

/** Four lines, no more, no fewer. The mind is told so in a schema, not only in words. */
const verseSchema = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      items: { type: 'string' },
      minItems: 4,
      maxItems: 4,
    },
  },
  required: ['lines'],
}

/** Asks the mind for a verse. Throws if it answers in a shape that is not a verse. */
export async function askVerse(
  instruction: string,
  verse: string,
  temperature: number,
): Promise<string[]> {
  const answer = await ask<{ lines?: unknown }>({
    instruction,
    input: verse,
    schema: verseSchema,
    temperature,
  })
  const lines = answer?.lines
  if (
    !Array.isArray(lines) ||
    !lines.every((line) => typeof line === 'string')
  ) {
    throw new Error(
      `the mind answered something that is not a verse: ${JSON.stringify(answer)}`,
    )
  }
  return lines.map((line: string) => line.trim())
}
