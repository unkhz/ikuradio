import { describe, expect, it } from 'bun:test'
import { fit, mostSqueeze, requestOf, rezzy } from '../index.js'

/** A speaking throat that takes a tenth of a second a word, and a tenth less for each tenth of rate more. */
const said = (request: { text: string; rate: number }) => ({ end: (request.text.split(/\s+/).length * 0.3) / request.rate })

describe('requestOf', () => {
  it('asks for the text in the DJ\'s voice, hurried by what it is told to', () => {
    expect(requestOf(rezzy, 'Hello.')).toEqual({ text: 'Hello.', body: { female: 0.5, child: 0.05 }, f0: 232, rate: 1.1, accent: 0.2 })
    expect(requestOf(rezzy, 'Hello.', 1.2).rate).toBe(1.32)
  })
})

describe('fit', () => {
  const text = 'Hello there, friend. Here is a slow song about rain. I hope you like it.'

  it('says what fits as it is', async () => {
    expect(await fit(rezzy, text, 10, said)).toMatchObject({ text, squeeze: 1 })
  })

  it('hurries the speech a little when a little is enough', async () => {
    const got = (await fit(rezzy, text, 3.6, said))!
    expect(got.text).toBe(text)
    expect(got.squeeze).toBeGreaterThan(1)
    expect(got.squeeze).toBeLessThanOrEqual(mostSqueeze)
    expect(got.seconds).toBeLessThanOrEqual(3.6)
  })

  it('cuts to fewer words, whole sentences if it can, when hurrying is not enough', async () => {
    const got = (await fit(rezzy, text, 2.5, said))!
    expect(text.startsWith(got.text)).toBe(true)
    expect(got.text.length).toBeLessThan(text.length)
    expect(got.seconds).toBeLessThanOrEqual(2.5)
    expect(got.text.endsWith('.')).toBe(true)
  })

  it('says nothing when not even a word fits', async () => {
    expect(await fit(rezzy, text, 0.01, said)).toBeUndefined()
    expect(await fit(rezzy, '', 5, said)).toBeUndefined()
  })
})
