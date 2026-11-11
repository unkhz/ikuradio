import { afterEach, describe, expect, it } from 'bun:test'
import { ask, Unshapely } from './mind.js'

const real = globalThis.fetch
afterEach(() => {
  globalThis.fetch = real
})

const answering = (content: string) => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }))) as unknown as typeof fetch
}

const question = { instruction: 'i', input: 'x', schema: {}, temperature: 0 }

describe('ask', () => {
  it('returns what the mind answered, in its shape', async () => {
    answering('{"lines":["a"]}')
    expect(await ask(question)).toEqual({ lines: ['a'] })
  })

  it('knows an answer cut off from a mind out of reach', async () => {
    answering('{"lines":["a long line that the mind never fini')
    expect(ask(question)).rejects.toBeInstanceOf(Unshapely)
    globalThis.fetch = (async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch
    const away = await ask(question).catch((error) => error)
    expect(away).not.toBeInstanceOf(Unshapely)
  })
})
