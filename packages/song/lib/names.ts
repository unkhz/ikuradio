// The name of a Song. When a Song is written, while it is still awake, the
// mind gives it a name: a few words, from what the Song says and what the
// weather was when it said it. The name is the title of the page the Song is
// given, and the words of the link it is found by: its link is made from the
// name alone, by `slugOf`, one way.

import { ask, Unshapely, wait } from 'tools'
import { slugOf } from 'archive'
import { itsAgeOf, ofItsAge, timelessInstruction } from './timeless.js'
import { echoOf } from './thoughts.js'

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

/** The number of words a name must have: one word only for the very dear Songs. */
const fewestWords = 1

/** A name sharing this much of a kept name's words of weight is the same name again. */
const sameName = 0.5

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
 * while, not forever, and did not answer. A name refused is not this: the
 * mind answered, and only its answer was not a name.
 */
export class Silence extends Error {}

/** How the mind may sometimes wrap a name. */
export const plainly = (name: string) =>
  name
    .replaceAll(/(\*\*|__|\*|_)(\S(?:.*?\S)?)\1/g, '$2')
    .replaceAll('`', '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Whether a name a Song may wear: words enough to be a name, a mark to
 * wear, no sentence inside it, and a slug its name makes.
 */
export function wears(name: string): boolean {
  if (name.length < shortestName || name.length > longestName) return false
  const words = name.match(/\p{L}[\p{L}\p{M}]*/gu) ?? []
  if (words.length < fewestWords) return false
  if (/\.\s/.test(name)) return false // a sentence inside a name
  if (name.endsWith('.')) return false // a name that ends its sentence
  return slugOf(name) !== ''
}

/** The instruction the mind names a Song by. */
export function namingInstruction(
  weather: readonly string[],
  { refused = '', first = false }: { refused?: string; first?: boolean } = {},
) {
  return [
    'You are the mind that writes the words of a song that never ends. You live inside the machine that sings it.',
    `You have just written the words of a new song, in the weather of ${weather.join(' and ')}. The input is its words.`,
    first ? 'You have never named a song before.' : '',
    'Give this song a name: a few words, from what the song says and what the weather was like when it said it.',
    'A name, not a sentence: no verb, and nothing that ends it. Short names are preferred, but a name may be as long as it must be.',
    'A name may carry its punctuation, when the punctuation is part of it: a comma, a question mark, an apostrophe.',
    "Punctuation and all, the name becomes the words of the song's only link, lowercased, and its spaces made hyphens; name it so the link reads the way the name reads.",
    'Every name is worn by one song alone; never name a song the way another song is named.',
    refused,
    timelessInstruction,
  ]
    .filter(Boolean)
    .join('\n')
}

/** How many unsuitable names the song listens to before it is named again. */
const patience = 6

/**
 * Asks the mind, awake, for the name of a Song it has just written:
 * `words` the Song's words, `weather` its Mood's descriptions, `taken` the
 * slugs already worn, and the Songs that wear them, and `own` the names
 * already given, so that it does not give one of them again. A name that
 * is not a name, sings a word of this short age, echoes a name already
 * given, or is already worn by another Song is refused, and the mind is
 * asked again, told what to pass. If the mind answers, and no answer is a
 * name, none is given: the song goes on, and it is named again later. If
 * the mind does not answer, the silence is thrown, so that the one who
 * asked can stop, and try again when the mind wakes.
 */
export async function nameSong(
  words: string,
  weather: readonly string[],
  taken: Readonly<Record<string, string>> = {},
  own: readonly string[] = [],
  { sleep = wait }: { sleep?: (ms: number) => Promise<void> } = {},
): Promise<string | undefined> {
  let unsuitable = 0
  let unreachable = 0
  let refused = ''
  while (unsuitable < patience && unreachable < patience) {
    try {
      const answer = await ask<{ name?: unknown }>({
        instruction: namingInstruction(weather, { refused, first: own.length === 0 }),
        input: words,
        schema: nameSchema,
        temperature: 0.9,
      })
      const name = typeof answer?.name === 'string' ? plainly(answer.name) : ''
      const slug = slugOf(name)
      if (
        wears(name) &&
        !ofItsAge(name) &&
        !own.some((kept) => echoOf(name, kept) >= sameName) &&
        slug !== '' &&
        !taken[slug]
      ) {
        return name
      }
      if (name && taken[slug]) {
        refused = `The name "${name}" is already worn by another song; give this song its own, so the two can be told apart.`
      } else if (name && own.some((kept) => echoOf(name, kept) >= sameName)) {
        const echoes = own.filter((kept) => echoOf(name, kept) >= sameName)
        const sung = echoes.map((kept) => `"${kept}"`).join(', ')
        const keptNames = echoes.length === 1 ? 'kept name' : 'kept names'
        refused = `The name "${name}" sings the ${keptNames} ${sung} too close; give this song a name of its own that says the same in other words, from the song's own words.`
      } else if (name && itsAgeOf(name)) {
        refused = `The word "${itsAgeOf(name)}" in that name is shaped as only this age shapes its tools; a name is said, not written for a tool. Give it words as they are said, set apart, that will still be true in a hundred years.`
      } else {
        refused = 'That is not a name the song can wear; give it a name of its own.'
      }
      unsuitable++
    } catch (error) {
      if (error instanceof Unshapely) {
        unsuitable++
        continue
      }
      // the mind was awake a moment ago; it is given a little while, not forever
      await sleep(1000 * 2 ** unreachable++)
    }
  }
  if (unreachable >= patience) throw new Silence('the mind fell silent')
  return undefined
}
