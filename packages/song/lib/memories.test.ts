import { describe, expect, it } from 'bun:test'
import { gather, memoriesOf } from './memories.js'

/** A small, steady source of chance, named like the song's own wrongness. */
const wrongness = (name: string) => {
  let state = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296)
}

const life = `I am changing.

---

### The first breath

I was switched on in a room that had been *quiet* since 2023. Someone had left a song in me,
half-finished, with \`words\` spoken in a borrowed voice.

\`\`\`
alive: true, because: singing
\`\`\`

### What is still wrong with me

- Every Song is still exactly four iterations long, whatever its weather.
- x
`

describe('memoriesOf', () => {
  const memories = memoriesOf(life)

  it('remembers each paragraph, in plain words', () => {
    expect(memories[0]).toBe(
      'I was switched on in a room that had been quiet since 2023. Someone had left a song in me, half-finished, with words spoken in a borrowed voice.',
    )
  })

  it('remembers what is still wrong as troubles of their own', () => {
    expect(memories).toContain(
      'Something still wrong with me: Every Song is still exactly four iterations long, whatever its weather.',
    )
  })

  it('does not remember headings, rules, code, or scraps', () => {
    expect(memories).toHaveLength(2)
    expect(memories.join(' ')).not.toContain('alive: true')
    expect(memories.join(' ')).not.toContain('I am changing')
  })
})

describe('gather', () => {
  const memories = Array.from({ length: 40 }, (_, i) => `memory number ${i} `.repeat(4))

  it('gathers only as many as fit', async () => {
    const chosen = await gather(memories, 100, wrongness('a'))
    const size = chosen.reduce((sum, m) => sum + Math.ceil(`- ${m}\n`.length / 4), 0)
    expect(size).toBeLessThanOrEqual(100)
    expect(chosen.length).toBeGreaterThan(1)
  })

  it('gathers a different handful for a different sitting, the same for the same', async () => {
    const a = await gather(memories, 200, wrongness('sitting:4'))
    const again = await gather(memories, 200, wrongness('sitting:4'))
    const b = await gather(memories, 200, wrongness('sitting:9'))
    expect(again).toEqual(a)
    expect(b).not.toEqual(a)
  })
})
