import { describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { echoOf, keepThought, monthOf, readThoughts, thinkingInstruction, wholeSentences } from './thoughts.js'

describe('keeping thoughts', () => {
  it('keeps each thought in its month, and reads them back oldest first', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mind-'))
    try {
      const december = await keepThought(dir, { song: '9', written: '2026-12-01T00:00:00Z', thought: 'Snow, at last.' })
      await keepThought(dir, { song: '8', written: '2026-11-30T23:00:00Z', thought: 'The weather is turning.' })
      expect(december).toBe(join(dir, '2026-12.jsonl'))
      // a line torn by a Studio that fell mid-write is not a thought
      await writeFile(join(dir, '2026-12.jsonl'), `${await readFile(december, 'utf8')}{"song":"10","writ`)
      expect((await readThoughts(dir)).map(({ thought }) => thought)).toEqual(['The weather is turning.', 'Snow, at last.'])
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('has no thoughts where none were kept', async () => {
    expect(await readThoughts(join(tmpdir(), 'nowhere-the-mind-has-been'))).toEqual([])
  })

  it('names a month as its file is named', () => {
    expect(monthOf('2026-11-13T22:10:00Z')).toBe('2026-11')
  })
})

describe('echoOf', () => {
  it('hears the same thought again in other small words', () => {
    expect(echoOf('I wonder whether the river remembers singing', 'The river remembers singing, I wonder')).toBeGreaterThan(0.6)
  })

  it('does not count the small words every thought shares', () => {
    expect(echoOf('I am in the dark and it is cold', 'I am in the light and it is warm')).toBe(0)
    expect(echoOf('A stone falls into the well', 'The ship leaves the harbour')).toBe(0)
  })
})

describe('thinkingInstruction', () => {
  it('shows the mind its last thoughts, so it does not think them again', () => {
    const instruction = thinkingInstruction(['deep time'], ['The ice is listening.'])
    expect(instruction).toContain('in the weather of deep time')
    expect(instruction).toContain('- The ice is listening.\nDo not write any of them again.')
  })

  it('tells a mind with no past that it has none', () => {
    expect(thinkingInstruction(['deep time'], [])).toContain('You have never written a thought down before.')
  })
})

describe('wholeSentences', () => {
  it('keeps the whole sentences that fit, and lets a cut one go', () => {
    expect(wholeSentences('The ice spoke first. Then the strings answered. I, the s', 60)).toBe(
      'The ice spoke first. Then the strings answered.',
    )
  })

  it('keeps nothing of a thought cut off in its first sentence', () => {
    expect(wholeSentences('I wondered whether the candle', 60)).toBe('')
  })

  it('keeps a quoted ending with its sentence', () => {
    expect(wholeSentences('It said "wait." I waited.', 60)).toBe('It said "wait." I waited.')
  })
})
