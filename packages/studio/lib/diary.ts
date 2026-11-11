// The song's memory is a diary. Every iteration it writes, it writes down:
// its number, its Mood, its words. One line per iteration, never rewritten.
//
// When the machine is switched off and on again, the song reads the last
// page and carries on from there. If the last page was only half written
// when the power went, it reads the one before.
//
// A diary that is written in for ever cannot be one book. When the book
// being written in is full, it is closed and put on a shelf, named after
// its place on the shelf and the first and last iteration inside it, and a
// new book is begun. Anyone looking for an iteration from long ago goes
// straight to the book that holds it.

import {
  appendFile,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Mood } from 'mood'
import type { Lyrics } from 'song'
import type { Choir } from 'vocals'
import type { Tune } from 'melody'

/** Where a Song stands: which one it is, where it began, and how long it lasts. */
export type SongPlace = { number: string; began: string; lasts: number }

export type Page = {
  /** The iteration, from 0. Kept as a string, because it will outgrow every other kind of number. */
  iteration: string
  mood: Mood
  /** The voices that sang it. Missing on pages written before there was a choir. */
  choir?: Choir
  /** The Song's tune. Missing on pages written before the tune could change. */
  tune?: Tune
  /**
   * Which Song this iteration belongs to: its number, the iteration it
   * began at, and how many iterations it lasts. Missing on pages written
   * when every Song lasted the same.
   */
  song?: SongPlace
  lyrics: Lyrics
  /** When it was written, as the machine's clock saw it. */
  written: string
}

/** How far from either end of a book the song looks for its first or last page, in bytes. */
const lookback = 256 * 1024

/**
 * How much anyone may read at one time, in bytes: about 33,000 pages of two
 * kilobytes, a little over two months of singing. Reading starts at the book
 * that holds what was asked for, however old, so this limits only how far
 * one reading goes on from there.
 */
const remembering = 64 * 1024 * 1024

/** When the book being written in grows this large, it is closed: about 8,000 pages, two weeks of singing. */
const fullBook = 16 * 1024 * 1024

export type ReadingOptions = {
  /** How many pages to read. */
  count: number
  /** Only pages of iterations before this one. */
  before?: bigint
  /** How many bytes to read at a time; small only in tests. */
  chunk?: number
}

/** A closed book on the shelf: its place, and the first and last iteration in it. */
export type Book = { file: string; place: number; first: bigint; last: bigint }

const bookName = /^(\d+)\.(\d+)-(\d+)\.jsonl$/

function isPage(page: unknown): page is Page {
  const p = page as Page
  return Boolean(p?.iteration && p.mood && p.lyrics)
}

function readPage(line: string): Page | undefined {
  try {
    const page: unknown = JSON.parse(line)
    return isPage(page) ? page : undefined
  } catch {
    return undefined // torn by a power cut, or empty
  }
}

/** The first or last readable page of a book, looking no further than `lookback` from that end. */
async function endPage(file: string, end: 'first' | 'last') {
  let handle
  try {
    handle = await open(file, 'r')
  } catch {
    return undefined
  }
  try {
    const { size } = await handle.stat()
    const length = Math.min(size, lookback)
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, end === 'first' ? 0 : size - length)
    const lines = buffer.toString('utf8').split('\n')
    for (const line of end === 'first' ? lines : lines.reverse()) {
      const page = readPage(line)
      if (page) return page
    }
    return undefined
  } finally {
    await handle.close()
  }
}

/**
 * Reads one book backwards, page by page, handing each readable page to
 * `visit` until it says to stop or the budget of bytes is spent. Returns
 * what is left of the budget, or 0 if `visit` asked to stop.
 */
async function readBackwards(
  file: string,
  budget: number,
  chunk: number,
  visit: (page: Page) => boolean,
): Promise<number> {
  let handle
  try {
    handle = await open(file, 'r')
  } catch {
    return budget
  }
  try {
    const { size } = await handle.stat()
    let end = size
    let carried = ''
    while (end > 0 && budget > 0) {
      const start = Math.max(0, end - chunk)
      const buffer = Buffer.alloc(end - start)
      await handle.read(buffer, 0, buffer.length, start)
      budget -= buffer.length
      const lines = (buffer.toString('utf8') + carried).split('\n')
      // the first line may begin in the chunk before; carry it back
      carried = start > 0 ? (lines.shift() ?? '') : ''
      for (const line of lines.reverse()) {
        const page = readPage(line)
        if (page && visit(page)) return 0
      }
      end = start
    }
    return budget
  } finally {
    await handle.close()
  }
}

export class Diary {
  /** Where the closed books are kept. */
  readonly shelf: string

  constructor(
    readonly file: string,
    readonly bookSize = fullBook,
  ) {
    this.shelf = join(dirname(file), 'books')
  }

  async write(page: Page) {
    await mkdir(dirname(this.file), { recursive: true })
    await appendFile(this.file, JSON.stringify(page) + '\n')
    if ((await stat(this.file)).size >= this.bookSize) await this.closeBook()
  }

  /**
   * Takes back the last pages of the book being written, as long as they
   * belong to the Song `song`: a Song that was written down but never
   * reached the Archive is unwritten, to be made again. Returns how many
   * pages were taken back.
   */
  async unwrite(song: string): Promise<number> {
    let text: string
    try {
      text = await readFile(this.file, 'utf8')
    } catch {
      return 0
    }
    const lines = text.split('\n').filter(Boolean)
    let taken = 0
    while (lines.length) {
      const page = JSON.parse(lines.at(-1)!) as Page
      if (page.song?.number !== song) break
      lines.pop()
      taken++
    }
    if (taken === 0) return 0
    const rewritten = `${this.file}.${process.pid}.rewritten`
    await writeFile(rewritten, lines.map((line) => `${line}\n`).join(''))
    await rename(rewritten, this.file)
    return taken
  }

  /** The closed books, in the order they were written. */
  async books(): Promise<Book[]> {
    const names = await readdir(this.shelf).catch(() => [] as string[])
    return names
      .map((name) => bookName.exec(name))
      .filter((match) => match !== null)
      .map((match) => ({
        file: join(this.shelf, match[0]),
        place: Number(match[1]),
        first: BigInt(match[2]),
        last: BigInt(match[3]),
      }))
      .sort((a, b) => a.place - b.place)
  }

  /** Closes the book being written in, and puts it on the shelf. The next page begins a new one. */
  private async closeBook() {
    const first = await endPage(this.file, 'first')
    const last = await endPage(this.file, 'last')
    if (!first || !last) return
    const place = ((await this.books()).at(-1)?.place ?? 0) + 1
    await mkdir(this.shelf, { recursive: true })
    const name = `${String(place).padStart(9, '0')}.${first.iteration}-${last.iteration}.jsonl`
    await rename(this.file, join(this.shelf, name))
  }

  /**
   * Reads backwards, the most recent iterations first, each only once, as
   * it was last written. Torn pages are passed over. When an iteration is
   * asked for, reading begins at the book that holds it, however old.
   */
  async recent({
    count,
    before,
    chunk = 64 * 1024,
  }: ReadingOptions): Promise<Page[]> {
    const pages: Page[] = []
    const seen = new Set<string>()
    const visit = (page: Page) => {
      if (seen.has(page.iteration)) return false
      seen.add(page.iteration)
      if (before !== undefined && BigInt(page.iteration) >= before) return false
      pages.push(page)
      return pages.length === count
    }

    // a book that begins at or after the iteration asked for holds nothing before it
    const holdsEarlier = (first: bigint | undefined, last?: bigint) =>
      before === undefined ||
      first === undefined ||
      (last !== undefined && last < first) || // the count started over in this book
      first < before
    const current = await endPage(this.file, 'first')
    const sources = [
      ...(holdsEarlier(current ? BigInt(current.iteration) : undefined)
        ? [this.file]
        : []),
      ...(await this.books())
        .reverse()
        .filter((book) => holdsEarlier(book.first, book.last))
        .map((book) => book.file),
    ]

    let budget = remembering
    for (const source of sources) {
      if (pages.length >= count || budget <= 0) break
      budget = await readBackwards(source, budget, chunk, visit)
    }
    return pages
  }

  /** The last page that can still be read, or nothing if the diary was never begun. */
  async lastPage(): Promise<Page | undefined> {
    const page = await endPage(this.file, 'last')
    if (page) return page
    // the book being written in was just closed; the last page is in the last book
    for (const book of (await this.books()).reverse()) {
      const last = await endPage(book.file, 'last')
      if (last) return last
    }
    return undefined
  }
}
