import { wait } from 'tools'
import { ask } from './mind.js'

/** A line the throat can carry in two bars without losing its breath. */
const fits = (line: string) => line.length > 15 && line.length < 81

/** What a small mind sometimes leaves in a verse that does not belong in a song. */
function clean(line: string) {
  return line
    .replaceAll(/<br\s*\/?>/g, '')
    .replace(/^#+\s*/, '')
    .trim()
}

/** How many unsuitable answers the song listens to before it gives up on something new. */
const patience = 8

export type EditOptions = {
  /** The verse may come back unchanged. True for the chorus, which is meant to stay. */
  mayRepeat?: boolean
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
  { mayRepeat = false }: EditOptions = {},
) {
  let unsuitable = 0
  let unreachable = 0
  while (unsuitable < patience) {
    try {
      const verse = (await ask({ instruction, verse: input, temperature })).map(
        clean,
      )
      const changed = verse.join('\n') !== input
      if (verse.length === 4 && verse.every(fits) && (changed || mayRepeat)) {
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
