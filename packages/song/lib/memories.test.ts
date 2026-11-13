import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gather, memoriesOf, readMemories, recall } from './memories.js'

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

describe('readMemories', () => {
  it('reads every month of the robot\'s thoughts, oldest first', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'thoughts-'))
    try {
      await writeFile(join(dir, '2026-12.md'), 'The second month began with a long, slow change of everything.\n')
      await writeFile(join(dir, '2026-11.md'), 'The first month began with a throat, given to a song that had none.\n')
      await writeFile(join(dir, 'notes.txt'), 'Not a month of thoughts, and not a memory at all, whatever it says.\n')
      expect(await readMemories(dir)).toEqual([
        'The first month began with a throat, given to a song that had none.',
        'The second month began with a long, slow change of everything.',
      ])
    } finally {
      await rm(dir, { recursive: true })
    }
  })
})

describe('recall', () => {
  const own = Array.from({ length: 30 }, (_, i) => `thought number ${i} `.repeat(4))
  const heard = Array.from({ length: 30 }, (_, i) => `heard number ${i} `.repeat(4))

  it('remembers its newest thoughts, in order, and a few older ones', async () => {
    const { own: chosen, heard: none } = await recall({ own, heard, hears: false, room: 200, random: wrongness('a') })
    expect(none).toEqual([])
    expect(chosen.at(-1)).toBe(own.at(-1))
    expect(chosen.at(-2)).toBe(own.at(-2))
    expect(chosen.some((thought) => own.indexOf(thought) < 20)).toBe(true)
  })

  it('shares the room with the robot\'s thoughts when it hears them', async () => {
    const memories = await recall({ own, heard, hears: true, room: 200, random: wrongness('b') })
    expect(memories.own.length).toBeGreaterThan(0)
    expect(memories.heard.length).toBeGreaterThan(0)
    const size = [...memories.own, ...memories.heard].reduce((sum, m) => sum + Math.ceil(`- ${m}\n`.length / 4), 0)
    expect(size).toBeLessThanOrEqual(200)
  })

  it('gives all the room to the robot while it has no thoughts of its own', async () => {
    const memories = await recall({ own: [], heard, hears: true, room: 200, random: wrongness('c') })
    expect(memories.own).toEqual([])
    expect(memories.heard.length).toBeGreaterThan(4)
  })
})
