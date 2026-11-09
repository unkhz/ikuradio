// The mind that writes the words. It is a small language model that lives on
// the same machine as the throat, served by Ollama. The song asks nobody far
// away for its next verse, and needs no key to anyone's door.

import { getEnv } from 'tools'

const { OLLAMA_HOST, LYRICS_MODEL } = getEnv()

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

export type Request = {
  /** What to do with the verse. */
  instruction: string
  /** The verse it is done to. */
  verse: string
  /** How far the mind may wander, from 0 (not at all) to about 1.5 (far). */
  temperature: number
}

/** Asks once. Throws if the mind is unreachable or answers in a shape that is not a verse. */
export async function ask({
  instruction,
  verse,
  temperature,
}: Request): Promise<string[]> {
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: LYRICS_MODEL,
      stream: false,
      think: false,
      format: verseSchema,
      options: { temperature },
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: verse },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(
      `the mind did not answer: ${response.status} ${await response.text()}`,
    )
  }
  const { message } = (await response.json()) as {
    message?: { content?: string }
  }
  const { lines } = JSON.parse(message?.content ?? '{}') as { lines?: unknown }
  if (
    !Array.isArray(lines) ||
    !lines.every((line) => typeof line === 'string')
  ) {
    throw new Error(
      `the mind answered something that is not a verse: ${message?.content}`,
    )
  }
  return lines.map((line: string) => line.trim())
}
