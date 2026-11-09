import { firstCharacter, type Character } from 'melody'
import { drift } from './lib/drift.js'
import { hear, settle } from './lib/character.js'
import { firstWeather, weather } from './lib/weather.js'

export { drift, hear, settle, weather, firstWeather }

/**
 * The weather a Song grows in. Every Iteration of a Song shares one Mood.
 * The words are written in it, and the tune is sung in its mode and tempo.
 */
export type Mood = {
  /** A few descriptions, blended. The oldest comes first. */
  descriptions: string[]
  /** What the mind heard in them. */
  character: Character
}

/** The Mood the song was born in: eternity, chamber music, A minor, 76 beats per minute. */
export const firstMood: Mood = {
  descriptions: [...firstWeather],
  character: firstCharacter,
}

/** The Mood of the next Song: one description lets go, one arrives, and the mind listens again. */
export async function nextMood(
  previous: Mood,
  count: number,
  random: () => number = Math.random,
): Promise<Mood> {
  const descriptions = drift(previous.descriptions, weather, count, random)
  const character = await hear(descriptions, previous.character)
  return { descriptions, character }
}

/** How a Mood reads, for anyone watching. */
export function describe({ descriptions, character }: Mood) {
  return `${descriptions.join(' + ')} (${character.mode}, ${character.tempo} bpm)`
}
