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

export type Page = {
  /** The iteration, from 0. Kept as a string, because it will outgrow every other kind of number. */
  iteration: string
  mood: Mood
  lyrics: Lyrics
  /** When it was written, as the machine's clock saw it. */
  written: string
}

/** How far back from the end the song looks for its last page, in bytes. */
const lookback = 256 * 1024

export class Diary {
  constructor(readonly file: string) {}

  async write(page: Page) {
    await mkdir(dirname(this.file), { recursive: true })
    await appendFile(this.file, JSON.stringify(page) + '\n')
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
