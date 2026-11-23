// The shadow (plan "The Studio on timelines", step 2): beside the Session `toSession` writes, the Studio writes the one the Arrangement's timeline gives, compares
// the two, and says where they differ. The shadow is never published, never changes what is, and never stops a Song from being kept: whatever goes wrong in it
// is said and left. It is switched over only once real Songs on the air have shown no difference.

import type { Loudness } from 'vocals'
import type { Session } from 'archive'
import type { Made } from './session.js'

/** Every place two values differ, each said with its path: "recordings[14].at: 43.3 ≠ 43.4". Arrays that are not the same length say so, and are compared as far as both go. */
export function differences(real: unknown, shadow: unknown, path = ''): string[] {
  const here = path || 'the Session'
  if (Array.isArray(real) && Array.isArray(shadow)) {
    const found = real.length === shadow.length ? [] : [`${here}: ${real.length} ≠ ${shadow.length} entries`]
    for (let i = 0; i < Math.min(real.length, shadow.length); i++) found.push(...differences(real[i], shadow[i], `${path}[${i}]`))
    return found
  }
  if (real && shadow && typeof real === 'object' && typeof shadow === 'object' && !Array.isArray(real) && !Array.isArray(shadow)) {
    const keys = new Set([...Object.keys(real), ...Object.keys(shadow)])
    return [...keys].flatMap((key) => {
      const a = (real as Record<string, unknown>)[key]
      const b = (shadow as Record<string, unknown>)[key]
      const there = path ? `${path}.${key}` : key
      if (a === undefined && b === undefined) return []
      if (a === undefined) return [`${there}: missing ≠ ${brief(b)}`]
      if (b === undefined) return [`${there}: ${brief(a)} ≠ missing`]
      return differences(a, b, there)
    })
  }
  return Object.is(real, shadow) ? [] : [`${here}: ${brief(real)} ≠ ${brief(shadow)}`]
}

const brief = (value: unknown) => {
  const text = JSON.stringify(value) ?? 'undefined'
  return text.length > 60 ? `${text.slice(0, 57)}...` : text
}

/** What the shadow is given beside the Session that was written: what `toSession` was given. */
export type ShadowOf = {
  made: readonly Made[]
  session: Session
  name: (file: string) => string
  loudness?: (file: string) => Loudness | undefined
  throat?: string
  thought?: string
  songName?: string
  /** The Arrangement the Song is made as: the Song as it always was, until the Song says another. */
  arrangement?: string
}

/** How many differences are said one by one: the rest are counted. */
const said = 40

/**
 * Writes the Session from the timeline and compares it with the one written, saying every difference (up to a few dozen; the rest are counted). It reads the Arrangements
 * where the Composer does, and never throws: a Studio whose shadow fails goes on, and says that it did. It returns the differences, or nothing if it could not be made.
 */
export async function shadowCheck({ made, session, name, loudness, throat, thought, songName, arrangement = 'the-song' }: ShadowOf, log: Pick<Console, 'log' | 'warn'> = console): Promise<string[] | undefined> {
  try {
    const { readArrangements, readParts, readTracks } = await import('parts')
    const { sessionOf } = await import('./timeline.js')
    const records = await readParts()
    const tracks = await readTracks()
    const found = (await readArrangements(records, undefined, tracks)).find((one) => one.arrangement.id === arrangement && one.state === 'active')
    if (!found) throw new Error(`there is no active Arrangement "${arrangement}"`)
    const shadow = sessionOf({ arrangement: found.arrangement, tracks, made, name, loudness, throat, thought, songName })
    const found_ = differences(JSON.parse(JSON.stringify(session)), JSON.parse(JSON.stringify(shadow)))
    if (found_.length === 0) log.log(`shadow: the Session from the timeline "${arrangement}" is the Session written`)
    else {
      log.warn(`shadow: the Session from the timeline "${arrangement}" differs from the Session written in ${found_.length} place${found_.length > 1 ? 's' : ''}:`)
      for (const line of found_.slice(0, said)) log.warn(`shadow:   ${line}`)
      if (found_.length > said) log.warn(`shadow:   and ${found_.length - said} more`)
    }
    return found_
  } catch (error) {
    log.warn(`shadow: the timeline could not write the Session: ${(error as Error).message}`)
    return undefined
  }
}
