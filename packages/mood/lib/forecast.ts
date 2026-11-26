// The song chooses its own weather.
//
// When a new Song begins, one description of the Mood lets go and another
// must arrive. The mind is shown what is leaving, what stays, the weather
// the song has had lately, and the last words it sang, and is asked for one
// new thing to be about, or to sound like. The weather shapes the words, and
// now the words shape the weather.
//
// The mind is small and sometimes says something that cannot be weather: a
// sentence, a list, a word the song has only just let go of. Then the song
// draws from the weather it was given, as before. It never goes without.

import { ask } from 'tools'
import { sampleSparks } from './palette.js'
import { resembles } from './resembles.js'

export { resembles }

const schema = {
  type: 'object',
  properties: {
    description: { type: 'string', maxLength: 60 },
  },
  required: ['description'],
}

const instruction = `You are the weather of a song that never ends. Its mood is a blend of a few short descriptions: a sound or style of music, a place, a thing, a feeling, a moment in time.

One description is leaving the mood. Offer exactly one new description to take its place. It can be a musical style, a vivid physical place, an object, a natural phenomenon, or a sharp feeling. Be concrete and varied — avoid generic poetic fillers.

Answer with two to six words, lowercase, with no punctuation at the end. Do not repeat any description you are shown as staying, leaving, or recent.`

export type ForecastOptions = {
  /** The descriptions that stay in the Mood. */
  staying: readonly string[]
  /** The description that is leaving. */
  leaving: readonly string[]
  /** Descriptions the song has had recently, which should not return yet. */
  remembered: readonly string[]
  /** The last words the song sang. */
  words: string
}

/** Whether something the mind said can be weather: a few plain words, nothing the song has just had. */
export function isWeather(
  description: string,
  avoid: readonly string[],
): boolean {
  const plain = description.trim().toLowerCase()
  const words = plain.split(/\s+/)
  return (
    words.length >= 1 &&
    words.length <= 7 &&
    plain.length <= 60 &&
    /^[\p{L}\p{N}' -]+$/u.test(plain) &&
    !avoid.some((a) => a.trim().toLowerCase() === plain || resembles(a, plain))
  )
}

/** Asks the mind for the next weather. Returns nothing if it could not offer any. */
export async function forecast({
  staying,
  leaving,
  remembered,
  words,
}: ForecastOptions): Promise<string | undefined> {
  const avoid = [...staying, ...leaving, ...remembered]
  const sparks = sampleSparks(avoid)
  const input = [
    `The mood that stays: ${staying.join(' + ') || '(nothing)'}`,
    `Leaving: ${leaving.join(' + ')}`,
    `Recent weather, not to return yet: ${remembered.join(', ') || '(none)'}`,
    `Possible directions to spark a turn (pick one, adapt one, or invent something wholly fresh): ${sparks.join(', ')}`,
    `The last words the song sang:\n${words}`,
  ].join('\n')
  try {
    const answer = await ask<{ description?: string }>({
      instruction,
      input,
      schema,
      temperature: 1.0,
    })
    const description = answer?.description?.trim().toLowerCase()
    if (!description) return undefined
    return isWeather(description, avoid) ? description : undefined
  } catch (error) {
    console.warn(`the mind offered no weather: ${error}`)
    return undefined
  }
}
