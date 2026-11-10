import { wait } from 'tools'
import { askVerse } from './mind.js'

/** A line the throat can carry in two bars without losing its breath. */
const fits = (line: string) => line.length > 15 && line.length < 81

/** What a small mind sometimes leaves in a verse that does not belong in a song. */
export function clean(line: string) {
  return line
    .replaceAll(/<br\s*\/?>/g, '')
    .replace(/^#+\s*/, '')
    .replaceAll(/(\*\*|__|\*|_)(\S(?:.*?\S)?)\1/g, '$2') // emphasis, as if it were a document
    .replaceAll('`', '')
    .trim()
}

/** How many unsuitable answers the song listens to before it gives up on something new. */
const patience = 8

export type EditOptions = {
  /** The verse may come back unchanged. True for the chorus, which is meant to stay. */
  mayRepeat?: boolean
  /** What else a verse must be to be sung, such as rhyming where it should. */
  accept?: (lines: string[]) => boolean
  /** How many unsuitable answers to listen to before singing the verse as it was. */
  patience?: number
}

/**
 * Asks the mind to change a verse, until it answers with a verse the song
 * can sing: four lines, each of a singable length, and, unless repeating is
 * allowed, not the same verse again.
 *
 * When the mind keeps answering with things that cannot be sung, the song
 * stops asking and sings the verse again as it was. A song may repeat
 * itself. It may not stop.
 *
 * When the mind cannot be reached at all, the song waits for it, asking
 * less and less often but never less than once a minute. A song that is
 * meant to run for a quadrillion years can wait for a mind that is busy,
 * sleeping, or not yet born.
 */
export async function editVerse(
  input: string,
  instruction: string,
  temperature: number,
  {
    mayRepeat = false,
    accept = () => true,
    patience: enough = patience,
  }: EditOptions = {},
) {
  let unsuitable = 0
  let unreachable = 0
  while (unsuitable < enough) {
    try {
      const verse = (await askVerse(instruction, input, temperature)).map(clean)
      const changed = verse.join('\n') !== input
      if (
        verse.length === 4 &&
        verse.every(fits) &&
        (changed || mayRepeat) &&
        accept(verse)
      ) {
        return verse.join('\n')
      }
      unsuitable++
    } catch (error) {
      if (unreachable % 10 === 0) {
        console.warn(`waiting for the mind (${unreachable + 1}): ${error}`)
      }
      await wait(Math.min(60_000, 100 * 2 ** unreachable++))
    }
  }
  return input
}
