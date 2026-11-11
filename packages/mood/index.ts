import { firstCharacter, type Character } from 'melody'
import { hear, settle } from './lib/character.js'
import { firstWeather, weather } from './lib/weather.js'
import { forecast, isWeather } from './lib/forecast.js'

export { hear, settle, weather, firstWeather, forecast, isWeather }

/**
 * The weather a Song grows in. Every Iteration of a Song shares one Mood.
 * The words are written in it, and the tune is sung in its mode and tempo.
 */
export type Mood = {
  /** A few descriptions, blended. The oldest comes first. */
  descriptions: string[]
  /** What the mind heard in them. */
  character: Character
  /**
   * Descriptions that have left lately, the oldest first. They do not return
   * until they have been forgotten. Missing in Moods older than this memory.
   */
  remembered?: string[]
}

/** How many departed descriptions the weather remembers. */
const memory = 12

/** The Mood the song was born in: eternity, chamber music, A minor, 76 beats per minute. */
export const firstMood: Mood = {
  descriptions: [...firstWeather],
  character: firstCharacter,
}

export type NextMoodOptions = {
  /** The last words the song sang, so that the words can shape the weather. */
  words?: string
  /** A number in [0, 1), like Math.random, for drawing from the list. */
  random?: () => number
  /**
   * Whether the mind is asked at all. Without it, the weather is drawn from
   * the list and the tune keeps the character it had.
   */
  mind?: boolean
}

/**
 * The Mood of the next Song: the oldest description lets go, and a new one
 * arrives. The mind chooses it, from the Mood and the last words sung; if it
 * cannot, the new description is drawn from the list. Then the mind listens
 * to the new Mood and decides its mode and tempo.
 */
export async function nextMood(
  previous: Mood,
  count: number,
  { words = '', random = Math.random, mind = true }: NextMoodOptions = {},
): Promise<Mood> {
  const staying = previous.descriptions.slice(
    Math.max(0, previous.descriptions.length - count + 1),
  )
  const leaving = previous.descriptions.filter((d) => !staying.includes(d))
  const remembered = [...(previous.remembered ?? []), ...leaving].slice(-memory)
  const descriptions = [...staying]

  while (descriptions.length < count) {
    const offered = mind
      ? await forecast({ staying: descriptions, leaving, remembered, words })
      : undefined
    if (offered && !descriptions.includes(offered)) {
      descriptions.push(offered)
      continue
    }
    const avoid = new Set([...descriptions, ...leaving, ...remembered])
    const fresh = weather.filter((d) => !avoid.has(d))
    const pool =
      fresh.length > 0
        ? fresh
        : weather.filter((d) => !descriptions.includes(d))
    if (pool.length === 0) break
    descriptions.push(pool[Math.floor(random() * pool.length)])
  }

  const character = mind
    ? await hear(descriptions, previous.character)
    : previous.character
  return { descriptions, character, remembered }
}

/** How a Mood reads, for anyone watching. */
export function describe({ descriptions, character }: Mood) {
  const sound = character.sound ? `, ${character.sound}` : ''
  return `${descriptions.join(' + ')} (${character.mode}, ${character.tempo} bpm${sound})`
}
