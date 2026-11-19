// The encore's first setup, Favourites (plan "Encores"): the critic's
// favourites, rotated. The critic's file is hand-written and the scientist's;
// the Radio only reads it. A favourite is a Song, `1`, or a section of one,
// `"45:3"`, and an encore plays the Song: a section counts as its Song.

/** A critic's file, as the Studio reads it. */
export type Critic = { favorites?: Partial<Record<string, (number | string)[]>> }

/** The order the three lists are flattened into: the song's own, verse before chorus before bridge. */
const parts = ['verse', 'chorus', 'bridge']

/** The Songs a critic names, each once, in the order the lists give them; anything unreadable is left out. */
export function favouriteSongs(critic: Critic | undefined): string[] {
  const named = parts.flatMap((part) => {
    const listed = critic?.favorites?.[part]
    return Array.isArray(listed) ? listed : []
  })
  const songs = named.flatMap((favourite) => {
    const match = /^(\d{1,400})(?::\d+)?$/.exec(String(favourite).trim())
    return match ? [`${BigInt(match[1]!)}`] : []
  })
  return [...new Set(songs)]
}

/**
 * The Songs to try for the next encore, in turn: the one after the last
 * encore aired, then each after it, round again to the last itself. A last
 * that is no longer a favourite starts the list over, so a restart does not
 * always begin at the first, and a changed file does not strand it.
 */
export function inTurn(favourites: readonly string[], last: string | undefined): string[] {
  const at = last === undefined ? -1 : favourites.indexOf(last)
  return [...favourites.slice(at + 1), ...favourites.slice(0, at + 1)]
}
