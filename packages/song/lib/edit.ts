import { Unshapely, wait } from 'tools'
import { askVerse } from './mind.js'

/** A line the throat can carry in two bars without losing its breath. */
const fitsLine = (line: string, minLength: number) => line.length >= minLength && line.length < 81

/** What a small mind sometimes leaves in a verse that does not belong in a song. */
export function clean(line: string) {
  return line
    .replaceAll(/<br\s*\/?>/g, '')
    .replace(/^#+\s*/, '')
    .replaceAll(/(\*\*|__|\*|_)(\S(?:.*?\S)?)\1/g, '$2') // emphasis, as if it were a document
    .replaceAll('`', '')
    .trim()
    .replace(/^[:;,.\-–—>|]+\s*/, '') // punctuation a line cannot begin with
}

/** A line as it sounds: its words, without their punctuation or capitals. */
const sounding = (line: string) =>
  line
    .toLowerCase()
    .replace(/[^\p{L}0-9' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Whether a verse only echoes another: most of its lines sound the same as
 * the other's, whatever their commas. A mind asked for the next verse will
 * sometimes hand the last one back with its punctuation moved.
 */
export function echoes(verse: readonly string[], other: readonly string[]) {
  const heard = new Set(other.map(sounding))
  const threshold = Math.max(1, Math.ceil(verse.length * 0.75))
  return verse.filter((line) => heard.has(sounding(line))).length >= threshold
}

/** How many unsuitable answers the song listens to before it gives up on something new. */
const patience = 8

export type EditOptions = {
  /** The verse may come back unchanged. True for the chorus, which is meant to stay. */
  mayRepeat?: boolean
  /** Expected number of lines (defaults to 4). */
  lines?: number
  /** Shortest accepted line in characters (defaults to 16). */
  minLength?: number
  /** What else a verse must be to be sung, such as rhyming where it should, or fitting its bars. */
  accept?: (lines: string[]) => boolean | Promise<boolean>
  /** How many unsuitable answers to listen to before singing the verse as it was. */
  patience?: number
  /**
   * What to tell the mind about a verse that was not accepted, so that its
   * next try may do better: said with the next asking, and only that one.
   */
  advise?: (lines: string[]) => Promise<string | undefined> | string | undefined
}

/**
 * Asks the mind to change a verse, until it answers with a verse the song
 * can sing: `lines` lines (four by default), each of a singable length, and,
 * unless repeating is allowed, not the same verse again.
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
    lines: expected = 4,
    minLength = 16,
    accept = () => true,
    patience: enough = patience,
    advise,
  }: EditOptions = {},
) {
  let unsuitable = 0
  let unreachable = 0
  let note: string | undefined
  const previous = input ? input.split('\n') : []
  while (unsuitable < enough) {
    try {
      const verse = (await askVerse(note ? `${instruction}\n${note}` : instruction, input, temperature)).map(clean).filter(Boolean)
      const changed = previous.length === 0 || !echoes(verse, previous)
      if (
        verse.length === expected &&
        verse.every((line) => fitsLine(line, minLength)) &&
        (changed || mayRepeat) &&
        (await accept(verse))
      ) {
        return verse.join('\n')
      }
      // a verse of the right shape that was not taken: the mind is told why, if it can be told
      note = verse.length === expected && advise ? await advise(verse) : undefined
      unsuitable++
    } catch (error) {
      if (error instanceof Unshapely) {
        // the mind is there, and only said too much; it is asked again at once
        unsuitable++
        continue
      }
      if (unreachable % 10 === 0) {
        console.warn(`waiting for the mind (${unreachable + 1}): ${error}`)
      }
      await wait(Math.min(60_000, 100 * 2 ** unreachable++))
    }
  }
  return input
}
