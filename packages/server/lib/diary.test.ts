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
})
