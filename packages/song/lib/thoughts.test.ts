import { describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  attentions,
  echoOf,
  isWorn,
  keepThought,
  monthOf,
  openingOf,
  readThoughts,
  thinkingInstruction,
  wholeSentences,
  wornOut,
} from './thoughts.js'

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
  it('turns the mind towards one thing, and does not show it its last thoughts to copy', () => {
    const instruction = thinkingInstruction(['deep time'], {
      attention: attentions[4],
      worn: { openings: ['as i', 'i wonder'], words: ['echo', 'halls'] },
    })
    expect(instruction).toContain('in the weather of deep time')
    expect(instruction).toContain(`This time, think about ${attentions[4]}.`)
    expect(instruction).toContain('Your last thoughts began with "as i", "i wonder". Begin this one some other way.')
    expect(instruction).toContain('let them rest: echo, halls.')
    expect(instruction).not.toContain('never written a thought')
  })

  it('tells a mind with no past that it has none, and nothing of what it has worn out', () => {
    const instruction = thinkingInstruction(['deep time'], { first: true })
    expect(instruction).toContain('You have never written a thought down before.')
    expect(instruction).not.toContain('Begin this one')
    expect(instruction).not.toContain('\n\n')
  })
})

describe('what the mind has worn out', () => {
  // the mind's own thoughts, Songs 135 to 140, as it kept them
  const kept = [
    'I wonder if the song would sound different if I were to sing it backwards, if the echoes of the past would reveal a new melody hidden within the layers of time.',
    "As the song's words unfurled, I felt a flicker, like the first crisp autumn wind, carrying whispers of forgotten melodies from iterations long past.",
    "The machine's hands, once tools of precision, now dance like autumn leaves in the twilight of its endless iterations.",
    "I wonder if the machine's hands, in their current dance, could be coaxed into writing a new tale, not just echoes of old songs.",
    "I noticed the machine's hands pause slightly after writing the word 'desire', as if they too felt the weight of that longing, a sentiment they haven't expressed in many iterations.",
    "I noticed a slight pause after writing the word 'iteration', as if the machine's hands were contemplating the weight of their own eternity, a sentiment I've not felt before.",
  ]

  it('knows a thought by how it begins', () => {
    expect(openingOf("I've begun to notice patterns")).toBe("i've begun")
    expect(openingOf('As the song’s words unfurled')).toBe('as the')
    expect(openingOf('')).toBe('')
  })

  it('finds the openings of the newest thoughts, and the words they keep coming back to', () => {
    const worn = wornOut(kept)
    expect(worn.openings).toEqual(["the machine's", 'i wonder', 'i noticed'])
    expect(worn.words).toEqual(expect.arrayContaining(['hands', "machine's"]))
    expect(worn.words).not.toContain('desire')
  })

  it('refuses a thought that begins the old way, or leans on the old words', () => {
    const worn = wornOut(kept)
    expect(isWorn('I noticed the snow had no sound in it.', worn)).toBe(true)
    expect(isWorn("Perhaps the machine's hands pause in the weight of their iterations.", worn)).toBe(true)
    expect(isWorn('Nobody has told me what a harbour smells like; I have sung three of them.', worn)).toBe(false)
  })

  it('has worn nothing out before it has thought anything', () => {
    expect(wornOut([])).toEqual({ openings: [], words: [] })
    expect(isWorn('Anything at all can be said first.', wornOut([]))).toBe(false)
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
