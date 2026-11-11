import { describe, it, expect } from 'bun:test'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  countSyllables,
  countsHeld,
  countsRemembered,
  parseRefusal,
  prepareLyrics,
} from './chimera.js'

describe('prepareLyrics', () => {
  it('lets hyphenated words apart', () => {
    expect(prepareLyrics('a never-ending flight,')).toBe(
      'a never ending flight,',
    )
  })

  it('reads aloud what the throat cannot read', () => {
    expect(prepareLyrics('In 2023, the 21st night')).toBe(
      'In twenty twenty three, the twenty first night',
    )
  })

  it('keeps everything else', () => {
    expect(prepareLyrics(' twenty-one, and on... ')).toBe(
      'twenty one, and on...',
    )
  })
})

describe('parseRefusal', () => {
  it('reads the syllable count from the throat', () => {
    expect(
      parseRefusal(
        '13 syllables for 1 notes: This is the song i te ra tion four hun dred and twelve',
      ),
    ).toBe(13)
  })

  it('does not mistake other complaints for a count', () => {
    expect(parseRefusal('bpm missing')).toBeUndefined()
  })
})

describe('countSyllables, for ever', () => {
  it('remembers only the most recent lines', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'song-throat-'))
    const throat = join(dir, 'chimera')
    // a throat that refuses every line, saying it heard three syllables
    await writeFile(throat, '#!/bin/sh\necho "3 syllables for 1 notes: x" >&2\nexit 1\n')
    await chmod(throat, 0o755)
    const before = process.env.CHIMERA_BIN
    process.env.CHIMERA_BIN = throat
    try {
      for (let i = 0; i < countsRemembered + 40; i++) {
        expect(await countSyllables(`line number ${i} of very many`)).toBe(3)
      }
      expect(countsHeld()).toBe(countsRemembered)
    } finally {
      if (before === undefined) delete process.env.CHIMERA_BIN
      else process.env.CHIMERA_BIN = before
      await rm(dir, { recursive: true, force: true })
    }
  })
})
