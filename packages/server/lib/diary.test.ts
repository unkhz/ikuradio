import { mkdtemp, rm, appendFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Diary, type Page } from './diary.js'

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
})
