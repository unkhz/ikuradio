// The sitemap (plan "Song names"): every Song's address, and nothing else, but only once the Song
// has its intro. A search quotes a Song by what Rezzy says of it (see `excerptOf` in speaks.ts),
// and a Song is not put before a crawler until it has those words. An intro is made after its Song
// has aired, so a new Song comes to the sitemap a little after it has been heard, and the Songs the
// Archive held before intros were made come to it as theirs are made.

import type { DjDeclaration } from 'archive'
import { escaped } from './speaks.js'

/** Whether a declaration says words: what a Song's excerpt is made of. */
export const saysWords = (declaration: DjDeclaration | undefined): boolean => !!declaration?.parts?.intro?.speech?.text?.trim()

/** The Songs known to have their intro. An intro, once made, is not taken away, so it is asked about no more. */
export class Introduced {
  private readonly done = new Set<string>()

  has(song: string): boolean {
    return this.done.has(song)
  }

  get size(): number {
    return this.done.size
  }

  /**
   * Asks, `few` at a time, about every Song of `songs` not yet known to have its intro, and
   * keeps the ones that have. A Song whose answer cannot be had is asked about next time.
   * Returns how many it learned of.
   */
  async learn(songs: Iterable<string>, declaration: (song: string) => Promise<DjDeclaration | undefined>, few = 8): Promise<number> {
    const asking = [...new Set(songs)].filter((song) => !this.done.has(song))
    let learned = 0
    const work = async () => {
      for (let song = asking.shift(); song !== undefined; song = asking.shift()) {
        if (saysWords(await declaration(song).catch(() => undefined))) {
          this.done.add(song)
          learned++
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(few, asking.length) }, work))
    return learned
  }
}

const sortable = (song: string) => `${String(song.length).padStart(4, '0')}:${song}`

/**
 * The sitemap: the address of each of `songs` that has its intro and is named, newest first.
 * `slugs` is each Song's slug, by its number.
 */
export function sitemapOf(origin: string, songs: Iterable<string>, introduced: { has(song: string): boolean }, slugs: ReadonlyMap<string, string>): string {
  const urls = [...new Set(songs)]
    .filter((song) => introduced.has(song) && slugs.has(song))
    .sort((a, b) => (sortable(a) < sortable(b) ? 1 : -1))
    .map((song) => `  <url>\n    <loc>${escaped(`${origin}/s/${song}/${slugs.get(song)}`)}</loc>\n  </url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}
