import { afterEach, describe, expect, it } from 'bun:test'
import { slugOf } from 'archive'
import { modifyingInstruction, namelessOf, namingInstruction, nameSong, plainly, Silence } from './names.js'

/** A mind that answers, from a shelf of answers. */
const mind = (answers: string[], host = 'http://no-mind-here.invalid') => {
  process.env.MIND_HOST = host
  let asked = 0
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (url: unknown) => {
    expect(`${url}`).toBe(`${host}/v1/chat/completions`)
    const content = answers[Math.min(asked++, answers.length - 1)]!
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
  }) as typeof fetch
  return { asked: () => asked, done: () => (globalThis.fetch = realFetch) }
}

/** A mind that answers, from a shelf of answers, keeping every question it was asked. */
const remembering = (answers: string[]) => {
  process.env.MIND_HOST = 'http://no-mind-here.invalid'
  const realFetch = globalThis.fetch
  const instructions: string[] = []
  const inputs: string[] = []
  let asked = 0
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(`${init?.body}`) as { messages: { content: string }[] }
    instructions.push(body.messages[0].content)
    inputs.push(body.messages[1].content)
    const content = answers[Math.min(asked++, answers.length - 1)]!
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
  }) as typeof fetch
  return { asked: () => asked, instructions, inputs, done: () => (globalThis.fetch = realFetch) }
}

describe('plainly', () => {
  it('takes the name out of the marks the mind wrapped it in', () => {
    expect(plainly('**Hollow death**')).toBe('Hollow death')
    expect(plainly('__Hollow death__')).toBe('Hollow death')
    expect(plainly('`Hollow death`')).toBe('Hollow death')
    expect(plainly('"Hollow death"')).toBe('Hollow death')
    expect(plainly("'Hollow death'")).toBe('Hollow death')
    expect(plainly('“Hollow death”')).toBe('Hollow death')
    expect(plainly('  Hollow   death  ')).toBe('Hollow death')
  })

  it('keeps the punctuation that is inside the name', () => {
    expect(plainly("Death-machine, the Song's 2nd birth?")).toBe("Death-machine, the Song's 2nd birth?")
  })
})

describe('namelessOf', () => {
  it('names a Song by its own number', () => {
    expect(namelessOf('934')).toBe('Nameless 934')
  })

  it('makes a name whose slug is its own alone', () => {
    expect(slugOf(namelessOf('934'))).toBe('nameless-934')
  })

  it('is said apart, when another Song already wears the slug its number makes', () => {
    expect(namelessOf('7', { 'nameless-7': '6' })).toBe('Nameless 7 2')
    expect(namelessOf('7', { 'nameless-7': '6', 'nameless-7-2': '6' })).toBe('Nameless 7 3')
  })
})

describe('namingInstruction', () => {
  it('tells the mind the weather, and asks for a name, not a sentence', () => {
    const instruction = namingInstruction(['deep time', 'salt'])
    expect(instruction).toContain('in the weather of deep time and salt')
    expect(instruction).toContain('Give this song a name')
    expect(instruction).toContain('A name, not a sentence')
  })

  it('tells a mind with a past that it has one, and one without a past that it does not', () => {
    expect(namingInstruction(['rain'], { first: true })).toContain('You have never named a song before.')
    expect(namingInstruction(['rain'])).not.toContain('You have never named a song before.')
  })

  it('says nothing to the mind of links, or of slugs, or of the names other Songs wear', () => {
    const instruction = namingInstruction(['rain'])
    expect(instruction).not.toContain('link')
    expect(instruction).not.toContain('slug')
    expect(instruction).not.toContain('never name')
  })
})

describe('modifyingInstruction', () => {
  it('tells the mind the name it gave, and why it cannot be worn, and asks it to make the Song its own', () => {
    const instruction = modifyingInstruction(['deep time'], 'Hollow death')
    expect(instruction).toContain('in the weather of deep time')
    expect(instruction).toContain('You gave this song the name "Hollow death"')
    expect(instruction).toContain('that name is already worn by another song')
    expect(instruction).toContain('with a qualifier added')
    expect(instruction).toContain('A name, not a sentence')
  })
})

describe('nameSong', () => {
  afterEach(() => {
    delete process.env.MIND_HOST
  })

  it('names a Song, and unwraps the name it is given', async () => {
    const fake = mind(['{"name": "**Hollow death**"}'])
    try {
      expect(await nameSong('the river remembers', ['deep time'])).toBe('Hollow death')
    } finally {
      fake.done()
    }
  })

  it('asks the mind to make the Song its own of a worn name, giving it the words and the name it gave', async () => {
    const fake = remembering(['{"name": "Hollow death"}', '{"name": "Hollow death, by boredom"}'])
    try {
      expect(await nameSong('the river remembers', ['deep time'], { 'hollow-death': '1' })).toBe('Hollow death, by boredom')
      expect(fake.asked()).toBe(2)
      expect(fake.instructions[1]).toContain('You gave this song the name "Hollow death"')
      expect(fake.instructions[1]).toContain('a qualifier')
      expect(fake.inputs[0]).toBe('the river remembers')
      expect(fake.inputs[1]).toBe('the river remembers')
    } finally {
      fake.done()
    }
  })

  it('asks for the name from the start again, when the qualifier is worn too', async () => {
    const fake = remembering([
      '{"name": "Hollow death"}',
      '{"name": "Hollow death, by boredom"}',
      '{"name": "A long, slow thaw"}',
    ])
    try {
      expect(
        await nameSong('the river remembers', ['deep time'], { 'hollow-death': '1', 'hollow-death-by-boredom': '2' }),
      ).toBe('A long, slow thaw')
      expect(fake.asked()).toBe(3)
      expect(fake.instructions[1]).toContain('You gave this song the name "Hollow death"')
      expect(fake.instructions[2]).toContain('Give this song a name')
      expect(fake.instructions[2]).not.toContain('You gave this song the name')
    } finally {
      fake.done()
    }
  })

  it('gives no name, when no name comes, and asks no more', async () => {
    const fake = mind(['this is not an answer', '{"name": "   "}'])
    try {
      expect(await nameSong('the river remembers', ['deep time'])).toBeUndefined()
      expect(fake.asked()).toBe(6)
    } finally {
      fake.done()
    }
  })

  it('tells of the silence, when the mind does not answer', async () => {
    process.env.MIND_HOST = 'http://no-mind-here.invalid'
    const realFetch = globalThis.fetch
    let asked = 0
    globalThis.fetch = (async (_url: unknown) => {
      asked++
      throw new Error('fetch failed')
    }) as unknown as typeof fetch
    try {
      await expect(
        nameSong('the river remembers', ['deep time'], {}, { sleep: async () => {} }),
      ).rejects.toThrow(Silence)
      expect(asked).toBe(6)
    } finally {
      globalThis.fetch = realFetch
      delete process.env.MIND_HOST
    }
  })
})
