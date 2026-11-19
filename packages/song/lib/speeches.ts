// What a DJ says before a Song (plan "Intro with Rezzy"). An intro is made
// after its Song has aired: the Song is historical by then, and the mind is
// asked, awake, what the DJ says to introduce it. It is given what it knows of
// the Song: its name, its weather, its sound, and what the mind itself thought
// of it, never its words. It is not the Song's thought, which the mind keeps for
// itself, and the DJ does not read the Song out. It is said by the DJ, on a Song's
// page, over fifteen seconds of music.
//
// The only thing checked is that the speech is of a sensible length for those
// fifteen seconds, counted in syllables: a DJ speaks at about four a second, and
// the speech and the beginning of the Song overlap a little, so it need not be
// exact. A speech too long is asked for again, shorter; if it is still too long,
// it is cut at a sentence.

import { ask, Unshapely, wait } from 'tools'
import { plainly, Silence } from './names.js'
import { stresses } from './stress.js'

/** A speech as it is given: the words only. */
export type Speaking = { speech: string }

/**
 * How many syllables a speech may have, to be sensible for fifteen seconds: a
 * DJ speaks at about four syllables a second, drawing a word out now and then,
 * so fifty fill the room the music leaves, and a few more only spill a little
 * into the beginning of the Song.
 */
export type Range = { least: number; most: number }
export const sensibly: Range = { least: 20, most: 50 }

const speechSchema = {
  type: 'object',
  properties: { speech: { type: 'string', minLength: 3, maxLength: 500 } },
  required: ['speech'],
}

/** What the mind knows of a Song, which is all that it is given: never its words. */
export type Facts = {
  name: string
  weather: readonly string[]
  /** The band the mind heard in the weather, if it heard one. */
  sound?: string
  mode: string
  tempo: number
  /** What the mind thought of the Song when it wrote it, if it thought anything. */
  thought?: string
}

/** The Song as the mind is given it: a few lines. */
export const factsInput = ({ name, weather, sound, mode, tempo, thought }: Facts) =>
  [
    `Name: ${name}`,
    `Weather: ${weather.join(' and ')}`,
    ...(sound ? [`Sound: ${sound}`] : []),
    `Key and pace: ${mode}, ${tempo} beats a minute`,
    ...(thought ? [`What you thought of it: ${thought}`] : []),
  ].join('\n')

/** The instruction the mind writes a DJ's speech by; `last` says how the last try missed, if it did. */
export function speakingInstruction(persona: string, range: Range = sensibly, last?: 'long' | 'short') {
  return [
    'You are the mind that writes the words of a song that never ends. You live inside the machine that sings it.',
    'The input is what you know of one of its songs: its name, its weather, its sound, and what you thought of it when you wrote it.',
    persona,
    'Write what the DJ says to introduce this song to someone who has come to hear it. It is said aloud over fifteen seconds of music, just before the song begins.',
    `About ${range.least + 10} to ${range.most - 8} syllables: two or three short sentences. Say the song's name once, or its weather, or what it feels like; draw on what you thought of it, but do not quote it.`,
    'Plain words and ordinary punctuation only: letters, commas, full stops, apostrophes. No digits, no emoji, no stage directions, no quotation marks.',
    ...(last === 'long' ? ['Your last try was too long. Make it shorter.'] : last === 'short' ? ['Your last try was too short. Say a little more.'] : []),
  ].join('\n')
}

/** What the DJ says, as the throat can read it: plain, one line. */
export const spokenPlainly = (speech: string) =>
  plainly(speech)
    .replace(/[^\p{L}\p{M}\s,.;:!?'’—-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** How many syllables a text has, as the throat's dictionary tells, and a vowel group each for a word it does not know. */
export async function syllableCount(text: string): Promise<number> {
  const words = await stresses(text)
  return words.reduce((sum, word) => sum + (word.stresses?.length ?? Math.max(1, (word.text.match(/[aeiouy]+/g) ?? []).length)), 0)
}

/** The text cut at its last whole sentence that fits in `most` syllables, or, if not even the first does, at the last word that does. */
export async function cutTo(text: string, most: number, count: (text: string) => Promise<number> = syllableCount): Promise<string> {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g)?.map((s) => s.trim()) ?? [text]
  let kept = ''
  for (const sentence of sentences) {
    const next = kept ? `${kept} ${sentence}` : sentence
    if ((await count(next)) > most) break
    kept = next
  }
  if (kept) return kept
  const words = text.split(/\s+/)
  let at = 0
  while (at < words.length && (await count(words.slice(0, at + 1).join(' '))) <= most) at++
  return words.slice(0, Math.max(1, at)).join(' ').replace(/[,;:]$/, '').replace(/([^.!?])$/, '$1.')
}

/**
 * Asks the mind, awake, what a DJ says to introduce a Song, given what the
 * mind knows of it. A speech outside `range` is asked for again, up to three
 * times, and then the closest is cut, or, if too short to be anything, none
 * is given: the Song still has its intro, and the DJ does not come out. If the
 * mind does not answer, the silence is thrown, as when a Song is named.
 */
export async function writeSpeech(
  persona: string,
  facts: Facts,
  {
    range = sensibly,
    count = syllableCount,
    asker = ask,
    sleep = wait,
  }: {
    range?: Range
    count?: (text: string) => Promise<number>
    asker?: typeof ask
    sleep?: (ms: number) => Promise<void>
  } = {},
): Promise<string | undefined> {
  let unreachable = 0
  let tries = 0
  let empty = 0
  let last: 'long' | 'short' | undefined
  let closest: { text: string; n: number } | undefined
  while (tries < 3 && empty < 3 && unreachable < 4) {
    try {
      const answer = await asker<Speaking>({
        instruction: speakingInstruction(persona, range, last),
        input: factsInput(facts),
        schema: speechSchema,
        temperature: 0.9,
      })
      const text = typeof answer?.speech === 'string' ? spokenPlainly(answer.speech) : ''
      if (!text) {
        empty++
        continue
      }
      tries++
      const n = await count(text)
      if (n >= range.least && n <= range.most) return text
      last = n > range.most ? 'long' : 'short'
      const gap = (m: number) => Math.max(range.least - m, m - range.most)
      if (!closest || gap(n) < gap(closest.n)) closest = { text, n }
    } catch (error) {
      if (error instanceof Unshapely) {
        empty++
        continue
      }
      await sleep(1000 * 2 ** unreachable++)
    }
  }
  if (unreachable >= 4) throw new Silence('the mind fell silent')
  if (!closest) return undefined
  if (closest.n > range.most) return cutTo(closest.text, range.most, count)
  // too short to be an introduction, or short and still something: only the first is refused
  return closest.n >= Math.floor(range.least / 2) ? closest.text : undefined
}
