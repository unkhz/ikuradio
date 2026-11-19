// The name of a Song. When a Song is written, while it is still awake, the
// mind gives it a name: a few words, from what the Song says and what the
// weather was when it said it. The name is the title of the page the Song is
// given, and the words of the link it is found by: its link is made from the
// name alone, by `slugOf`, one way.

import { ask, Unshapely, wait } from 'tools'
import { slugOf } from 'archive'

/** A name as it is given: words only, no account of them. */
export type Naming = {
  name: string
}

/**
 * A name is short: few words, few marks, one line on a page. There is no
 * ceiling on a name's words beyond this, so a name may be as long as it must
 * be; short is only what is preferred.
 */
export const longestName = 120
const shortestName = 3

/** The schema a name is answered with. */
const nameSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: shortestName, maxLength: longestName },
  },
  required: ['name'],
}

/**
 * The mind fell silent: it was awake a moment ago, and was given a little
 * while, not forever, and did not answer. An answer that names no Song is
 * not this: the mind answered, and only its answer was no name.
 */
export class Silence extends Error {}

/** How the mind may sometimes wrap a name. */
export const plainly = (name: string) =>
  name
    .replaceAll(/(\*\*|__|\*|_)(\S(?:.*?\S)?)\1/g, '$2')
    .replaceAll('`', '')
    .replace(/^[\"'“”]+|[\"'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * The name a Song wears when no mind gives it one: its own number, said as
 * a name. A Song's number is worn by that Song alone, so the slug the name
 * makes is never another Song's — save on the day a mind has already named
 * some other Song so, and then this name is said apart. The namelessness
 * is the Song's lore, told by the Archive itself, and its link is made
 * like any other's.
 */
export function namelessOf(song: string, worn: Readonly<Record<string, string>> = {}): string {
  const said = `Nameless ${song}`
  let name = said
  for (let apart = 2; worn[slugOf(name)] !== undefined; apart++) name = `${said} ${apart}`
  return name
}

/** The instruction the mind names a Song by. */
export function namingInstruction(weather: readonly string[], { first = false }: { first?: boolean } = {}) {
  return [
    'You are the mind that writes the words of a song that never ends. You live inside the machine that sings it.',
    `You have just written the words of a new song, in the weather of ${weather.join(' and ')}. The input is its words.`,
    first ? 'You have never named a song before.' : '',
    'Give this song a name: a few words, from what the song says and what the weather was like when it said it.',
    'A name, not a sentence: no verb, and nothing that ends it. Short names are preferred, but a name may be as long as it must be.',
    'A name may carry its punctuation, when the punctuation is part of it: a comma, a question mark, an apostrophe.',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * The instruction the mind is asked by again, when the name it gave is
 * already worn by another song. The mind holds nothing between its answers,
 * so it is given the Song's words again, and told the name it gave, and
 * asked to make the Song's own of it — a qualifier, perhaps.
 */
export function modifyingInstruction(weather: readonly string[], name: string) {
  return [
    'You are the mind that writes the words of a song that never ends. You live inside the machine that sings it.',
    `You have just written the words of a new song, in the weather of ${weather.join(' and ')}. The input is its words.`,
    `You gave this song the name "${name}", but that name is already worn by another song.`,
    'Give this song its own name: perhaps the name you gave it, with a qualifier added that makes it its own, as long as it needs to be.',
    'A name, not a sentence: no verb, and nothing that ends it. Short names are preferred, but a name may be as long as it must be.',
    'A name may carry its punctuation, when the punctuation is part of it: a comma, a question mark, an apostrophe.',
  ].join('\n')
}

/** How many answers that name no Song are listened to, before the Song is named by its own number. */
const patience = 6

/**
 * Asks the mind, awake, for the name of a Song it has just written: `words`
 * the Song's words, `weather` its Mood's descriptions, and `taken` the slugs
 * already worn, and the Songs that wear them. A name whose slug is worn by
 * another Song is asked after once more: the mind is told the name it gave,
 * and asked to make the Song's own of it, a qualifier perhaps. A qualifier
 * that is worn too is asked for from the start again, and this goes on until
 * a name is the Song's own, for a Song is not published without one. If the
 * mind answers, and no answer names a Song, none is given: the song goes on,
 * and the Song is named by its own number. If the mind does not answer, the
 * silence is thrown, so that the one who asked can stop, and try again when
 * the mind wakes.
 */
export async function nameSong(
  words: string,
  weather: readonly string[],
  taken: Readonly<Record<string, string>> = {},
  { sleep = wait }: { sleep?: (ms: number) => Promise<void> } = {},
): Promise<string | undefined> {
  let nameless = 0
  let unreachable = 0
  let gave: string | undefined // the name the mind gave, worn by another song
  while (nameless < patience && unreachable < patience) {
    const modified = gave !== undefined
    const instruction = gave
      ? modifyingInstruction(weather, gave)
      : namingInstruction(weather, { first: Object.keys(taken).length === 0 })
    gave = undefined
    try {
      const answer = await ask<Naming>({
        instruction,
        input: words,
        schema: nameSchema,
        temperature: 0.9,
      })
      const name = typeof answer?.name === 'string' ? plainly(answer.name) : ''
      const slug = slugOf(name)
      if (name && slug && !taken[slug]) return name
      if (name && slug) {
        // worn by another song: the mind is asked, once, to make the Song's
        // own of the name it gave; a qualifier worn too is asked for from
        // the start again
        if (!modified) gave = name
      } else {
        // no name came
        nameless++
      }
    } catch (error) {
      if (error instanceof Unshapely) {
        nameless++
        continue
      }
      // the mind was awake a moment ago; it is given a little while, not forever
      await sleep(1000 * 2 ** unreachable++)
    }
  }
  if (unreachable >= patience) throw new Silence('the mind fell silent')
  return undefined
}
