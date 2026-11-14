// Coming home (plan "Progressions, roaming and coming home"): a part heard
// from a homecoming Perspective sings the chords of a moment the song has
// already sung, one of a critic's favourites, under its new words.
//
// A critic's favourites are a hand-written file in critic/, the scientist's
// first: under each part, Songs, `1`, or one section of a Song, `"45:3"`,
// its third of that part. Nothing here writes there. A favourite is found in
// the Archive by what its Session holds, never by which Song it is: the
// guide hummed for that section, its chords if it kept them, or else its
// one-voice hum heard as chords on the spot; the nearest guide of the same
// part in the same iteration if that section had none of its own, then any
// of that part. A favourite with nothing usable is passed over, with a
// warning, for the next; with none left, the part roams, and says so.

import { readFile } from 'node:fs/promises'
import { harmonizeHum, modes, wrongness, type Progression } from 'melody'
import { archiveAddress, paths, type Session } from 'archive'

export type Part = 'verse' | 'chorus' | 'bridge'

/** A critic's file: under each part, its favourite Songs, or Songs' sections, `"45:3"`. */
export type Critic = { favorites: Partial<Record<Part, (number | string)[]>> }

/** What a section's chords were chosen by, as the Session keeps it: the Setting, the roots a known one took, or why a homecoming roamed. */
export type UsedProgression = Progression & {
  /** A homecoming that found no favourite it could use: the critic it looked to. */
  unfound?: string
}

/** A favourite: a Song, and, if precise, which of its sections of the part, counted from 1. */
export type Favourite = { song: string; section?: number; name: string }

/** A critic's favourites for a part, in the order written; anything unreadable is left out. */
export function favouritesOf(critic: Critic | undefined, part: Part): Favourite[] {
  const listed = critic?.favorites?.[part]
  if (!Array.isArray(listed)) return []
  return listed.flatMap((favourite): Favourite[] => {
    const match = /^(\d+)(?::(\d+))?$/.exec(String(favourite).trim())
    if (!match) return []
    return [{ song: match[1]!, ...(match[2] ? { section: Number(match[2]) } : {}), name: String(favourite).trim() }]
  })
}

/**
 * The chord roots a Session gives a part's section, `place` from 0, by the
 * first fallback that has any: that section's guide (its chords, or its hum
 * heard as chords); the nearest guide of the part in the same iteration;
 * the nearest of the part anywhere. Its sections are counted by place in
 * its first iteration, the last again where it has fewer.
 */
export function chordsIn(session: Session, part: Part, place: number): number[] | undefined {
  const mode = modes[session.mode as keyof typeof modes]
  const first = session.iterations?.[0]
  const own = first?.parts?.filter((p) => p.type === part) ?? []
  const guides = (session.guides ?? []).filter((g) => g.part === part)
  if (!mode || !guides.length) return undefined
  const target = own[Math.min(place, own.length - 1)]
  const at = target?.at ?? first?.at ?? 0
  const near = (a: { at: number }, b: { at: number }) => Math.abs(a.at - at) - Math.abs(b.at - at)
  const inFirst = first ? guides.filter((g) => g.at >= first.at - 0.5 && g.at < first.at + first.seconds) : []
  const exact = guides.find((g) => Math.abs(g.at - at) < 0.5)
  const guide = exact ?? [...inFirst].sort(near)[0] ?? [...guides].sort(near)[0]!
  const roots = guide.chords?.length ? guide.chords.map(({ root }) => root) : harmonizeHum(guide.score?.notes ?? [], mode)
  return roots.length ? roots : undefined
}

/** Where a critic's file is: critic/<name>.json at the project's root. */
const criticFile = (name: string) => new URL(`../../../critic/${name}.json`, import.meta.url)

/** What finding a favourite needs, given so a test can stand in for the Archive. */
export type Finding = {
  critic: (name: string) => Promise<Critic | undefined>
  session: (song: string) => Promise<Session | undefined>
  warn: (message: string) => void
}

const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`)
const critics = new Map<string, Promise<Critic | undefined>>()
const sessions = new Map<string, Promise<Session | undefined>>()

/** The Studio's own finding: the critic's file as it is now, the Archive's Sessions, each read once while the Studio lives. */
export const finding: Finding = {
  critic: (name) => {
    if (!critics.has(name)) {
      critics.set(
        name,
        readFile(criticFile(name), 'utf8')
          .then((text) => JSON.parse(text) as Critic)
          .catch((error: Error) => {
            console.warn(`the critic ${name} could not be read: ${error.message}`)
            return undefined
          }),
      )
    }
    return critics.get(name)!
  },
  session: (song) => {
    if (!sessions.has(song)) {
      // over HTTP, as a Receiver reads it: reading needs none of the Studio's keys
      const read = async () => {
        const response = await fetch(`${withSlash(archiveAddress())}${paths.session(song)}`)
        if (!response.ok) throw new Error(`the Archive answered ${response.status}`)
        return (await response.json()) as Session
      }
      sessions.set(
        song,
        read().catch((error: Error) => {
          console.warn(`Song ${song}'s Session could not be read: ${error.message}`)
          return undefined
        }),
      )
    }
    return sessions.get(song)!
  },
  warn: (message) => console.warn(message),
}

/**
 * The progression a section is composed by. A roaming Setting, or a known
 * one with its roots, is used as it is. A known one without roots comes
 * home to a favourite of the critic it names: the Song picks one by its own
 * wrongness, the same for all its sections of the part, each section taking
 * the favourite's section in the same place. A favourite it cannot use is
 * passed over for the next; with none, the section roams.
 */
export async function progressionOf(
  setting: Progression,
  { part, place, song }: { part: Part; place: number; song: string },
  find: Finding = finding,
): Promise<UsedProgression> {
  if (setting.style !== 'known' || !setting.known || setting.known.roots?.length) return setting
  const name = setting.known.from
  const favourites = favouritesOf(await find.critic(name), part)
  const start = Math.floor(wrongness(`favourite:${song}:${part}`)() * favourites.length)
  for (let k = 0; k < favourites.length; k++) {
    const favourite = favourites[(start + k) % favourites.length]!
    const session = await Promise.resolve()
      .then(() => find.session(favourite.song))
      .catch(() => undefined)
    let roots: number[] | undefined
    try {
      roots = session ? chordsIn(session, part, favourite.section ? favourite.section - 1 : place) : undefined
    } catch {
      roots = undefined
    }
    if (roots) return { ...setting, known: { from: `${name}:${favourite.name}`, roots } }
    find.warn(`the ${name}'s favourite ${part} ${favourite.name} gave no chords${session ? '' : ': its Session could not be read'}; the next is tried`)
  }
  find.warn(`none of the ${name}'s favourite ${part}s could be sung; the ${part} roams`)
  return { style: 'roaming', temperature: setting.temperature, pull: setting.pull, unfound: name }
}
