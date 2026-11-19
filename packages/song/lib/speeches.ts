// What a DJ says before a Song (plan "Intro with Rezzy"). Once a Song is
// written and named, while the mind is still awake, the mind writes what the
// DJ says to introduce it: a few short sentences, in the DJ's own manner.
// It is not the Song's thought, which the mind keeps for itself, and it is
// not the Song's words, which the DJ never reads out. It is said by the DJ,
// on a Song's page, in the four bars before the Song begins.

import { ask, Unshapely, wait } from 'tools'
import { plainly, Silence } from './names.js'

/** A speech as it is given: the words only. */
export type Speaking = { speech: string }

/** The longest a speech may be, in words, whatever the room: four bars are not long. */
export const mostWords = 36

const speechSchema = {
  type: 'object',
  properties: { speech: { type: 'string', minLength: 3, maxLength: 400 } },
  required: ['speech'],
}

/** The instruction the mind writes a DJ's speech by. `words` is how many it may use at most. */
export function speakingInstruction(persona: string, name: string, weather: readonly string[], words: number) {
  return [
    'You are the mind that writes the words of a song that never ends. You live inside the machine that sings it.',
    `You have just written a new song and named it "${name}", in the weather of ${weather.join(' and ')}. The input is its words.`,
    persona,
    'Write what the DJ says to introduce this song, in the moment before it begins, to someone who has just come to hear it.',
    `At most ${words} words, and fewer is better: one or two short sentences. Say the song's name once, or its weather, or what it feels like; do not read its words out.`,
    'Plain words and ordinary punctuation only: letters, commas, full stops, apostrophes. No digits, no emoji, no stage directions, no quotation marks.',
  ].join('\n')
}

/** What the DJ says, as the throat can read it: plain, one line. */
export const spokenPlainly = (speech: string) =>
  plainly(speech)
    .replace(/[^\p{L}\p{M}\s,.;:!?'’—-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Asks the mind, awake, what a DJ says to introduce a Song: `lyrics` the
 * Song's words. Nothing if the mind answers and says nothing usable: the
 * Song still has its intro, and the DJ does not come out. If the mind does
 * not answer, the silence is thrown, as when a Song is named.
 */
export async function writeSpeech(
  persona: string,
  lyrics: string,
  name: string,
  weather: readonly string[],
  { words = mostWords, sleep = wait }: { words?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<string | undefined> {
  let unreachable = 0
  let empty = 0
  while (empty < 3 && unreachable < 4) {
    try {
      const answer = await ask<Speaking>({
        instruction: speakingInstruction(persona, name, weather, Math.min(words, mostWords)),
        input: lyrics,
        schema: speechSchema,
        temperature: 0.9,
      })
      const speech = typeof answer?.speech === 'string' ? spokenPlainly(answer.speech) : ''
      if (speech) return speech
      empty++
    } catch (error) {
      if (error instanceof Unshapely) {
        empty++
        continue
      }
      await sleep(1000 * 2 ** unreachable++)
    }
  }
  if (unreachable >= 4) throw new Silence('the mind fell silent')
  return undefined
}
