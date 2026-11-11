// What the Heart counts on every beat: how many finished Songs wait in the
// Archive after the last one the Radio has reached.

const after = (a: string, b: string) => BigInt(a) > BigInt(b)

/**
 * How many of the Archive's Songs come after `reached`, the last Song the
 * Radio has played or announced. If it has never played anything, every
 * Song in the Archive is still to come.
 */
export function waitingAfter(songs: readonly string[], reached: string | null): number {
  return songs.filter((song) => reached === null || after(song, reached)).length
}
