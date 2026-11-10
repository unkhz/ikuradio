// The mind: a language model that lives on the same machine as the song,
// served by llama.cpp. The song asks nobody far away for anything, and
// needs no key to anyone's door.
//
// Every question is asked with a JSON schema, which llama.cpp turns into a
// grammar: the mind cannot answer in any other shape, because it cannot
// even begin to.

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
  const { MIND_HOST } = getEnv()
  const response = await fetch(`${MIND_HOST}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: input },
      ],
      temperature,
      // a verse, or a few words of weather: never more than this
      max_tokens: 400,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'answer', strict: true, schema },
      },
      // minds that like to think out loud are asked to answer instead
      chat_template_kwargs: { enable_thinking: false },
    }),
  })
  if (!response.ok) {
    throw new Error(
      `the mind did not answer: ${response.status} ${await response.text()}`,
    )
  }
  const { choices } = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return JSON.parse(choices?.[0]?.message?.content ?? 'null') as Answer
}
