// What the Heart counts on every beat: how many finished Songs wait in the
// Archive after the last one the Radio has reached.

const after = (a: string, b: string) => BigInt(a) > BigInt(b)

/** What the Radio tells of a Song it has airing: its number, and whether it is an encore, an old Song aired again. */
export type Told = { song: string; mode?: string } | null

/**
 * The last Song the Radio has reached, counting only what is live: the next
 * Song if it is one, else the one playing if it is. An encore is a Song aired
 * again, so its number says nothing of how far the live show has come; read as
 * if it did, the Heart would find every newer Song waiting, and call no Studio
 * while the Radio played one old Song after another. Undefined when neither is
 * live: the caller looks to the last live Song the Radio announced.
 */
export function liveReached(tactus: { playing: Told; next: Told }): string | undefined {
  const live = (told: Told) => (told && told.mode !== 'encore' ? told.song : undefined)
  return live(tactus.next) ?? live(tactus.playing)
}

/**
 * How many of the Archive's Songs come after `reached`, the last Song the
 * Radio has played or announced. If it has never played anything, every
 * Song in the Archive is still to come.
 */
export function waitingAfter(songs: readonly string[], reached: string | null): number {
  return songs.filter((song) => reached === null || after(song, reached)).length
}

/** What the Heart does on a beat: calls in a Studio, runs the intros, or lets be. */
export type Work = 'studio' | 'intros' | 'rest'

/**
 * What the Heart does next, with `waiting` Songs ahead of the Radio and `ahead` wanted. When enough
 * Songs wait, the slack is for intros. But a Studio that keeps pace with the Radio leaves no slack
 * (a Song is made in about seven minutes and sung in eight or nine, and the next is begun as one
 * is taken), so intros that wait for slack never come, and neither do the new Songs' own. So when
 * a Song does wait, and no intros have been made for `every` milliseconds (`since` is when they
 * last were asked for), a few are made before the next Studio is called. `restUntil` is when the
 * Heart last learned that none is needed, or that the run fell.
 */
export function nextWork({ waiting, ahead, since, every, restUntil, now }: { waiting: number; ahead: number; since: number; every: number; restUntil: number; now: number }): Work {
  const owed = waiting >= 1 && now - since >= every
  if (waiting >= ahead || owed) return now >= restUntil ? 'intros' : waiting >= ahead ? 'rest' : 'studio'
  return 'studio'
}
