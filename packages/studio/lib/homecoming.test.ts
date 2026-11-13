import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Diary, type Page } from './diary.js'
import { Forgotten, homecoming, recallDiary, recallThoughts, type Remembered } from './homecoming.js'

const page = (iteration: number, song: number): Page => ({
  iteration: String(iteration),
  mood: { descriptions: ['eternity'], character: { mode: 'aeolian', tempo: 76 } },
  lyrics: { firstVerse: 'a', secondVerse: 'b', thirdVerse: 'c', chorus: 'd', finalChorus: 'e' },
  song: { number: String(song), began: String(iteration), lasts: 1 },
  written: '2026-11-13T00:00:00.000Z',
})
const line = (iteration: number, song: number) => `${JSON.stringify(page(iteration, song))}\n`

/** An Archive kept in memory, to be read from as a bucket is. */
function archiveOf(kept: Record<string, string>, songs: string[] = []): Remembered & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    newestSong: async () => songs.at(-1),
    kept: async (prefix) => Object.keys(kept).filter((key) => key.startsWith(prefix)),
    copyOut: async (key, file) => {
      asked.push(key)
      if (!(key in kept)) return false
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, kept[key]!)
      return true
    },
  }
}

describe('homecoming', () => {
  let dir: string
  let diary: Diary
  let thoughts: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'homecoming-'))
    diary = new Diary(join(dir, 'memory', 'diary.jsonl'))
    thoughts = join(dir, 'memory', 'thoughts')
  })
  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('takes the whole diary back onto a machine that has forgotten it', async () => {
    const archive = archiveOf(
      {
        'diary/books/000000001.1-2.jsonl': line(1, 1) + line(2, 2),
        'diary/books/notes.txt': 'not a book',
        'diary/diary.jsonl': line(3, 3),
      },
      ['1', '2', '3'],
    )
    expect(await homecoming(archive, { diary, thoughts })).toEqual({ books: 2, months: 0 })
    expect((await diary.books()).map(({ place }) => place)).toEqual([1])
    expect((await diary.lastPage())?.iteration).toBe('3')
    expect(await readdir(diary.shelf)).toEqual(['000000001.1-2.jsonl'])
  })

  it('leaves a diary that has pages as it is', async () => {
    await diary.write(page(4, 4))
    const archive = archiveOf({ 'diary/diary.jsonl': line(3, 3) }, ['3'])
    expect(await recallDiary(archive, diary)).toBe(0)
    expect(archive.asked).toEqual([])
    expect((await diary.lastPage())?.iteration).toBe('4')
  })

  it('takes back a book being written in even when every book is closed', async () => {
    const archive = archiveOf({ 'diary/books/000000001.1-1.jsonl': line(1, 1) }, ['1'])
    expect(await recallDiary(archive, diary)).toBe(1)
    expect((await diary.lastPage())?.song?.number).toBe('1')
  })

  it('takes back only the months of thoughts the machine does not have', async () => {
    await mkdir(thoughts, { recursive: true })
    await writeFile(join(thoughts, '2026-11.jsonl'), 'mine\n')
    const archive = archiveOf({
      'thoughts/mind/2026-10.jsonl': 'older\n',
      'thoughts/mind/2026-11.jsonl': 'the vault\'s\n',
      'thoughts/mind/torn.jsonl.part': 'not a month',
    })
    expect(await recallThoughts(archive, thoughts)).toBe(1)
    expect(await readFile(join(thoughts, '2026-10.jsonl'), 'utf8')).toBe('older\n')
    expect(await readFile(join(thoughts, '2026-11.jsonl'), 'utf8')).toBe('mine\n')
  })

  it('does not wake on a diary that remembers less than the Archive holds', async () => {
    await diary.write(page(1, 1))
    await expect(homecoming(archiveOf({}, ['1', '2']), { diary, thoughts })).rejects.toBeInstanceOf(Forgotten)
  })

  it('does not wake with no diary at all while the Archive holds Songs', async () => {
    await expect(homecoming(archiveOf({}, ['1']), { diary, thoughts })).rejects.toThrow(/no Song/)
  })

  it('wakes on a diary one Song ahead, written but not yet published, and on an Archive that is empty', async () => {
    await diary.write(page(2, 2))
    expect(await homecoming(archiveOf({}, ['1']), { diary, thoughts })).toEqual({ books: 0, months: 0 })
    await rm(join(dir, 'memory'), { recursive: true })
    expect(await homecoming(archiveOf({}), { diary, thoughts })).toEqual({ books: 0, months: 0 })
  })

  it('still wakes when the thoughts cannot be taken back', async () => {
    await diary.write(page(1, 1))
    const archive = { ...archiveOf({}, ['1']), kept: async (prefix: string) => {
      if (prefix.startsWith('thoughts')) throw new Error('the vault is far away')
      return []
    } }
    expect(await homecoming(archive, { diary, thoughts })).toEqual({ books: 0, months: 0 })
  })
})
