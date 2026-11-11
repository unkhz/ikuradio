// The Tactus: the beat everyone keeps. It is nothing but a list of moments,
// each Song and when it began, and the Radio is its keeper.
//
// The next Song is the first one in the Archive after the last that aired.
// It begins the moment the last one ends, if it is ready by then, and if
// Receivers have had time to fetch it. If it arrives late, it begins a
// little while after it arrives: the song holds its breath, and every
// Receiver holds it at the same moment. Once a beginning has been told to
// anyone, it never moves.

export type Airing = {
  /** The Song, counted from 0. */
  song: string
  /** When it begins, in milliseconds since the epoch, on the Radio's clock. */
  begins: number
  /** How long it lasts. */
  seconds: number
}

/** When an Airing ends, in milliseconds since the epoch. */
export const endOf = ({ begins, seconds }: Airing) => begins + seconds * 1000

/** How long Receivers are given to fetch a Song that arrived late, in milliseconds. */
export const lead = 20_000

/** How long the song may be silent before its heart is said to have stopped, in milliseconds. */
export const grace = 15 * 60_000

const order = (a: string, b: string) =>
  BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0

export class Tactus {
  constructor(
    private readonly aired: Airing[] = [],
    private readonly now: () => number = Date.now,
  ) {}

  /** The Song playing now, if one is. */
  get playing(): Airing | undefined {
    const now = this.now()
    return this.aired.findLast((a) => a.begins <= now && now < endOf(a))
  }

  /** The Song announced to begin after now, if one is. */
  get next(): Airing | undefined {
    const now = this.now()
    return this.aired.find((a) => a.begins > now)
  }

  /** The Songs that have aired, the newest last. */
  get history(): readonly Airing[] {
    return this.aired
  }

  /** The Songs that could be announced next, of those the Archive has, in order. */
  candidates(songs: readonly string[]): string[] {
    const last = this.aired.at(-1)
    return [...songs].sort(order).filter((s) => !last || order(s, last.song) > 0)
  }

  /** Which Song should be announced next, of those the Archive has. */
  candidate(songs: readonly string[]): string | undefined {
    return this.candidates(songs)[0]
  }

  /**
   * Announces a Song, if none is waiting to begin yet. Returns the Airing,
   * to be remembered, or undefined if nothing changed.
   */
  announce(song: string, seconds: number): Airing | undefined {
    if (this.next) return undefined
    const last = this.aired.at(-1)
    const soonest = this.now() + lead
    const begins = last ? Math.max(endOf(last), soonest) : soonest
    const airing = { song, begins, seconds }
    this.aired.push(airing)
    return airing
  }

  /** Whether the song is alive: singing, about to, or not silent for too long. */
  pulse(): { alive: boolean; because: string } {
    const now = this.now()
    if (this.playing) return { alive: true, because: 'singing' }
    if (this.next) return { alive: true, because: 'about to begin the next Song' }
    const last = this.aired.at(-1)
    if (!last) return { alive: true, because: 'waiting for its first Song' }
    return now - endOf(last) < grace
      ? { alive: true, because: 'holding its breath: the next Song is late' }
      : { alive: false, because: 'silent for too long, and nothing announced' }
  }
}
