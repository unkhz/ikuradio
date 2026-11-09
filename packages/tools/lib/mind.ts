// The mind: a small language model that lives on the same machine as the
// song, served by Ollama. The song asks nobody far away for anything, and
// needs no key to anyone's door.
//
// Every question is asked with a JSON schema, so the answer comes back in
// the shape it was asked for, or not at all.

import { getEnv } from './env.js'

export type Question = {
  /** What the mind is, and what it should do. */
  instruction: string
  /** What it is given to work on. */
  input: string
  /** The shape of the answer, as a JSON schema. */
  schema: object
  /** How far the mind may wander, from 0 (not at all) to about 1.5 (far). */
  temperature: number
}

/** Asks once. Throws if the mind is unreachable or does not answer in the shape asked for. */
export async function ask<Answer>({
  instruction,
  input,
  schema,
  temperature,
}: Question): Promise<Answer> {
  const { OLLAMA_HOST, LYRICS_MODEL } = getEnv()
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: LYRICS_MODEL,
      stream: false,
      think: false,
      format: schema,
      options: { temperature },
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: input },
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
  return JSON.parse(message?.content ?? 'null') as Answer
}
