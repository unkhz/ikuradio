// The shelf: the beds a Song has grown, kept for playing again.
//
// A band does not write a new arrangement for every verse. It keeps a few,
// and plays them again, and now and then writes a new one. So does the
// song. When a Song begins, both its parts are given new beds. After that,
// each iteration grows a new bed for only one of its parts, and the other
// part plays one it has already played in this Song. Which part grows, and
// which old bed returns, is decided by the iteration's own wrongness, not
// by dice: the same iteration always makes the same choice.
//
// A bed belongs to its Song. When the Mood changes, the tempo and the key
// change with it, and an old bed would no longer fit the voice; the shelf
// is cleared.

import { wrongness } from 'vocals'
import type { Line } from './sections.js'

export type Part = Line['part']

/** How many beds of each part are remembered. */
export const shelfSize = 8

export class Shelf {
  private beds: Record<Part, string[]> = { verse: [], chorus: [] }
  private song?: string

  /**
   * What this iteration does for a part: grows a new bed, or plays one
   * from the shelf. A new Song, or an empty shelf, always grows.
   */
  choose(
    iteration: bigint,
    song: string,
    part: Part,
  ): { grow: true } | { grow: false; bed: string } {
    if (song !== this.song) return { grow: true }
    const kept = this.beds[part]
    if (kept.length === 0) return { grow: true }
    // one of the two parts grows each iteration; the other is played again
    const grows: Part = wrongness(`bed:${iteration}`)() < 0.5 ? 'verse' : 'chorus'
    if (part === grows) return { grow: true }
    const pick = Math.floor(wrongness(`again:${iteration}:${part}`)() * kept.length)
    return { grow: false, bed: kept[Math.min(pick, kept.length - 1)] }
  }

  /**
   * Puts a bed on the shelf. Returns the beds that left it: those of an
   * older Song, and the oldest of a part when there are too many.
   */
  keep(song: string, part: Part, bed: string): string[] {
    const departed: string[] = []
    if (song !== this.song) {
      departed.push(...this.beds.verse, ...this.beds.chorus)
      this.beds = { verse: [], chorus: [] }
      this.song = song
    }
    const kept = this.beds[part].filter((old) => old !== bed)
    kept.push(bed)
    while (kept.length > shelfSize) departed.push(kept.shift()!)
    this.beds[part] = kept
    return departed.filter((old) => old !== bed)
  }

  /** Every bed on the shelf. */
  get all(): string[] {
    return [...this.beds.verse, ...this.beds.chorus]
  }
}
