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

/**
 * The mind answered, but its answer was cut off or out of shape: it was
 * there, and it will answer again if asked. Not the same as a mind that
 * cannot be reached, which is waited for.
 */
export class Unshapely extends Error {
  constructor(answer: string) {
    super(`the mind's answer was out of shape: ${answer.slice(0, 120)}`)
  }
}

/** Asks once. Throws if the mind is unreachable, or Unshapely if it does not answer in the shape asked for. */
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
  const content = choices?.[0]?.message?.content ?? 'null'
  try {
    return JSON.parse(content) as Answer
  } catch {
    // most often a mind that talked past the end of what it was allowed to say
    throw new Unshapely(content)
  }
}

/**
 * How many pieces the mind breaks some text into. A word the mind knows
 * well is one piece; a rare word, or a name, is several. Throws if the mind
 * cannot be reached.
 */
export async function pieces(text: string): Promise<number> {
  const { MIND_HOST } = getEnv()
  const response = await fetch(`${MIND_HOST}/tokenize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ content: text }),
  })
  if (!response.ok) throw new Error(`the mind did not count: ${response.status}`)
  const { tokens } = (await response.json()) as { tokens?: unknown[] }
  if (!Array.isArray(tokens)) throw new Error('the mind did not count')
  return tokens.length
}
