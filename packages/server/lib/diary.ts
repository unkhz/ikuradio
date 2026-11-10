// The song's memory is a diary. Every iteration it writes, it writes down:
// its number, its Mood, its words. One line per iteration, never rewritten.
//
// When the machine is switched off and on again, the song reads the last
// page and carries on from there. If the last page was only half written
// when the power went, it reads the one before.

import { appendFile, mkdir, open } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Mood } from 'mood'
import type { Lyrics } from 'song'
import type { Choir } from 'vocals'
import type { Tune } from 'melody'

export type Page = {
  /** The iteration, from 0. Kept as a string, because it will outgrow every other kind of number. */
  iteration: string
  mood: Mood
  /** The voices that sang it. Missing on pages written before there was a choir. */
  choir?: Choir
  /** The Song's tune. Missing on pages written before the tune could change. */
  tune?: Tune
  lyrics: Lyrics
  /** When it was written, as the machine's clock saw it. */
  written: string
}

/** How far back from the end the song looks for its last page, in bytes. */
const lookback = 256 * 1024

/** How far back anyone may read at one time, in bytes. Further back than this, memory fades. */
const remembering = 64 * 1024 * 1024

export type ReadingOptions = {
  /** How many pages to read. */
  count: number
  /** Only pages of iterations before this one. */
  before?: bigint
  /** How many bytes to read at a time; small only in tests. */
  chunk?: number
}

function isPage(page: unknown): page is Page {
  const p = page as Page
  return Boolean(p?.iteration && p.mood && p.lyrics)
}

export class Diary {
  constructor(readonly file: string) {}

  async write(page: Page) {
    await mkdir(dirname(this.file), { recursive: true })
    await appendFile(this.file, JSON.stringify(page) + '\n')
  }

  /**
   * Reads backwards from the last page: the most recent iterations first,
   * each only once, as it was last written. Torn pages are passed over.
   * Nothing further back than `remembering` is read: that far back, the
   * diary is too long to leaf through, and memory fades.
   */
  async recent({
    count,
    before,
    chunk = 64 * 1024,
  }: ReadingOptions): Promise<Page[]> {
    let handle
    try {
      handle = await open(this.file, 'r')
    } catch {
      return []
    }
    try {
      const { size } = await handle.stat()
      const pages: Page[] = []
      const seen = new Set<string>()
      let end = size
      let carried = ''
      while (pages.length < count && end > 0 && size - end < remembering) {
        const start = Math.max(0, end - chunk)
        const buffer = Buffer.alloc(end - start)
        await handle.read(buffer, 0, buffer.length, start)
        const lines = (buffer.toString('utf8') + carried).split('\n')
        // the first line may begin in the chunk before; carry it back
        carried = start > 0 ? (lines.shift() ?? '') : ''
        for (const line of lines.reverse()) {
          let page: unknown
          try {
            page = JSON.parse(line)
          } catch {
            continue // torn, or empty
          }
          if (!isPage(page) || seen.has(page.iteration)) continue
          seen.add(page.iteration)
          if (before !== undefined && BigInt(page.iteration) >= before) continue
          pages.push(page)
          if (pages.length === count) break
        }
        end = start
      }
      return pages
    } finally {
      await handle.close()
    }
  }

  /** The last page that can still be read, or nothing if the diary was never begun. */
  async lastPage(): Promise<Page | undefined> {
    let handle
    try {
      handle = await open(this.file, 'r')
    } catch {
      return undefined
    }
    try {
      const { size } = await handle.stat()
      const length = Math.min(size, lookback)
      const buffer = Buffer.alloc(length)
      await handle.read(buffer, 0, length, size - length)
      const lines = buffer.toString('utf8').split('\n').reverse()
      for (const line of lines) {
        try {
          const page = JSON.parse(line) as Page
          if (page?.iteration && page.mood && page.lyrics) return page
        } catch {
          // a torn page, written as the power went; read the one before
        }
      }
      return undefined
    } finally {
      await handle.close()
    }
  }
}
