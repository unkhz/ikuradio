// Machines are lost. A disk wears out, a house is left, a new machine is
// built somewhere else and the Studio is woken on it, and it does not know
// the song: its diary is empty, and the mind has never thought anything.
//
// But the Archive remembers. After every Song the Studio leaves a copy of
// its diary there, and of the mind's thoughts, and so when it wakes it first
// takes back whatever this machine has lost: the closed books of the diary
// and the book being written in, if it has no pages at all, and every month
// of thoughts it does not have. Nothing the machine still has is written
// over. It only ever fills what is empty.
//
// And if, after that, the diary still remembers less than the Archive
// holds, the Studio does not wake. A song that began again from one would
// sing over Songs already heard, and the Archive is forever.

import { access } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { paths, type ArchiveStore } from 'archive'
import { bookName, type Diary } from './diary.js'

/** What of the Archive the homecoming needs: to read it, never to put. */
export type Remembered = Pick<ArchiveStore, 'newestSong' | 'kept' | 'copyOut'>

const month = /^\d{4}-\d{2}\.jsonl$/

const missing = (file: string) =>
  access(file).then(
    () => false,
    () => true,
  )

/** Takes back the months of the mind's thoughts that `dir` does not have. Returns how many. */
export async function recallThoughts(archive: Remembered, dir: string): Promise<number> {
  let taken = 0
  for (const key of await archive.kept(paths.thoughtsShelf)) {
    const name = basename(key)
    if (!month.test(name) || !(await missing(join(dir, name)))) continue
    if (await archive.copyOut(key, join(dir, name))) taken++
  }
  return taken
}

/**
 * Takes back the diary, if this machine has no page of it: the closed books
 * it does not have, and the book being written in. Returns how many books
 * were taken.
 */
export async function recallDiary(archive: Remembered, diary: Diary): Promise<number> {
  if (await diary.lastPage()) return 0
  let taken = 0
  for (const key of await archive.kept(paths.diaryShelf)) {
    const name = basename(key)
    if (!bookName.test(name) || !(await missing(join(diary.shelf, name)))) continue
    if (await archive.copyOut(key, join(diary.shelf, name))) taken++
  }
  // the book being written in had no readable page, so there is nothing in it to lose
  if (await archive.copyOut(paths.diary, diary.file)) taken++
  return taken
}

/** A diary that remembers less than the Archive holds. The Studio does not wake on it. */
export class Forgotten extends Error {}

/**
 * Wakes the Studio's memory on whatever machine it finds itself on: takes
 * back what was lost, and then makes sure that the diary reaches at least
 * as far as the Archive. Throws Forgotten if it does not.
 */
export async function homecoming(
  archive: Remembered,
  { diary, thoughts }: { diary: Diary; thoughts: string },
): Promise<{ books: number; months: number }> {
  const books = await recallDiary(archive, diary)
  // the thoughts are the mind's; losing them is sad, and not a reason to stop singing
  const months = await recallThoughts(archive, thoughts).catch((error: Error) => {
    console.warn(`the mind's thoughts could not be taken back from the Archive: ${error.message}`)
    return 0
  })
  const newest = await archive.newestSong()
  const remembered = (await diary.lastPage())?.song?.number
  if (newest !== undefined && (remembered === undefined || BigInt(remembered) < BigInt(newest))) {
    throw new Forgotten(
      `the diary remembers ${remembered === undefined ? 'no Song' : `only as far as Song ${remembered}`}, ` +
        `but the Archive holds Song ${newest}; the song does not begin again where it has already been`,
    )
  }
  return { books, months }
}
