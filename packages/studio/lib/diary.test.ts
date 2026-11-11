import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, appendFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Diary, type Page } from './diary.js'
import { firstMood } from 'mood'
import { firstLyrics } from 'song'

const page = (iteration: number): Page => ({
  iteration: String(iteration),
  mood: {
    descriptions: ['eternity'],
    character: { mode: 'aeolian', tempo: 76 },
  },
  lyrics: {
    firstVerse: 'a',
    secondVerse: 'b',
    thirdVerse: 'c',
    chorus: 'd',
    finalChorus: 'e',
  },
  written: '2026-11-09T00:00:00.000Z',
})

describe('Diary', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'diary-'))
  })
  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('remembers nothing before it is begun', async () => {
    expect(await new Diary(join(dir, 'diary.jsonl')).lastPage()).toBeUndefined()
  })

  it('reads its last page', async () => {
    const diary = new Diary(join(dir, 'memory', 'diary.jsonl'))
    await diary.write(page(0))
    await diary.write(page(1))
    expect((await diary.lastPage())?.iteration).toBe('1')
  })

  it('skips a page torn by a power cut', async () => {
    const diary = new Diary(join(dir, 'diary.jsonl'))
    await diary.write(page(7))
    await appendFile(diary.file, '{"iteration":"8","mood":{"descr')
    expect((await diary.lastPage())?.iteration).toBe('7')
  })

  it('reads backwards, newest first, across chunk boundaries', async () => {
    const diary = new Diary(join(dir, 'diary.jsonl'))
    for (let i = 0; i < 30; i++) await diary.write(page(i))
    const pages = await diary.recent({ count: 5, chunk: 300 })
    expect(pages.map((p) => p.iteration)).toEqual([
      '29',
      '28',
      '27',
      '26',
      '25',
    ])
  })

  it('reads only before an iteration, so the future stays unread', async () => {
    const diary = new Diary(join(dir, 'diary.jsonl'))
    for (let i = 0; i < 30; i++) await diary.write(page(i))
    const pages = await diary.recent({ count: 3, before: 10n, chunk: 300 })
    expect(pages.map((p) => p.iteration)).toEqual(['9', '8', '7'])
    expect(await diary.recent({ count: 3, before: 0n })).toEqual([])
  })

  it('remembers a retried iteration as it was last written, and passes over torn pages', async () => {
    const diary = new Diary(join(dir, 'diary.jsonl'))
    await diary.write(page(0))
    await diary.write({ ...page(1), written: 'first try' })
    await appendFile(diary.file, '{"iteration":"1","mo\n')
    await diary.write({ ...page(1), written: 'second try' })
    const pages = await diary.recent({ count: 10, chunk: 64 })
    expect(pages.map((p) => [p.iteration, p.written])).toEqual([
      ['1', 'second try'],
      ['0', '2026-11-09T00:00:00.000Z'],
    ])
  })

  it('has nothing to say before it is begun', async () => {
    expect(
      await new Diary(join(dir, 'none.jsonl')).recent({ count: 3 }),
    ).toEqual([])
  })

  describe('books', () => {
    // books small enough to hold about five pages each
    const small = 5 * (JSON.stringify(page(0)).length + 1)

    it('closes a full book and begins another, named after what it holds', async () => {
      const diary = new Diary(join(dir, 'memory', 'diary.jsonl'), small)
      for (let i = 0; i < 23; i++) await diary.write(page(i))
      const books = await diary.books()
      expect(books.length).toBeGreaterThan(2)
      expect(books[0].first).toBe(0n)
      books.forEach((book, b) => {
        expect(book.place).toBe(b + 1)
        if (b > 0) expect(book.first).toBe(books[b - 1].last + 1n)
      })
    })

    it('finds its last page even when the book was just closed', async () => {
      const diary = new Diary(join(dir, 'diary.jsonl'), small)
      let i = 0
      while ((await diary.books()).length === 0) await diary.write(page(i++))
      expect((await diary.lastPage())?.iteration).toBe(`${i - 1}`)
    })

    it('reads backwards across books, newest first', async () => {
      const diary = new Diary(join(dir, 'diary.jsonl'), small)
      for (let i = 0; i < 40; i++) await diary.write(page(i))
      const pages = await diary.recent({ count: 15, chunk: 256 })
      expect(pages.map((p) => Number(p.iteration))).toEqual(
        Array.from({ length: 15 }, (_, k) => 39 - k),
      )
    })

    it('goes straight to the book that holds an old iteration', async () => {
      const diary = new Diary(join(dir, 'diary.jsonl'), small)
      for (let i = 0; i < 60; i++) await diary.write(page(i))
      const pages = await diary.recent({ count: 3, before: 7n, chunk: 256 })
      expect(pages.map((p) => p.iteration)).toEqual(['6', '5', '4'])
    })
  })
})

describe('unwrite', () => {
  it('takes back the pages of a Song that was never published, and nothing before it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'song-unwrite-'))
    try {
      const diary = new Diary(join(dir, 'diary.jsonl'))
      const page = (iteration: number, song: string) => ({
        iteration: `${iteration}`,
        mood: firstMood,
        lyrics: firstLyrics,
        written: '2026-11-11T00:00:00.000Z',
        song: { number: song, began: '0', lasts: 4 },
      })
      for (const [i, s] of [[0, '0'], [1, '0'], [2, '1'], [3, '1']] as const) await diary.write(page(i, s))
      expect(await diary.unwrite('1')).toBe(2)
      expect((await diary.lastPage())?.iteration).toBe('1')
      expect(await diary.unwrite('7')).toBe(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
