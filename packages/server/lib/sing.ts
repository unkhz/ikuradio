import { SongPart } from 'packages/song/index.js'
import { typeLine, wait } from 'tools'

async function drain(it: AsyncIterableIterator<unknown>) {
  for await (const _ of it) {
    // just drain it, we don't care about the values
  }
}

export type IterationEvent = {
  type: 'iteration'
  content: bigint
}

export type PartEvent = {
  type: 'part'
  content: 'verse' | 'chorus'
}

export type LineEvent = {
  type: 'line'
  content: string
  part: SongPart['type']
  /** Which line of the part, from 0. */
  index: number
}

export type CharEvent = {
  type: 'char'
  content: string
}

export type SingEvent = IterationEvent | PartEvent | LineEvent | CharEvent

/**
 * How long to wait between typed characters: a fixed delay, or one decided
 * line by line, so that the words appear as fast as they are sung.
 */
export type Pace = number | ((line: LineEvent) => number)

async function* singPart(
  part: SongPart,
  pace: Pace,
): AsyncGenerator<SingEvent> {
  const { type, content } = part
  yield { type: 'part', content: type }
  let typingDelay = typeof pace === 'number' ? pace : 0
  for (const [index, line] of content.split('\n').entries()) {
    const event: LineEvent = { type: 'line', content: line, part: type, index }
    yield event
    const trimmedLine = line.trim()
    if (trimmedLine) {
      typingDelay = typeof pace === 'number' ? pace : pace(event)
      for await (const char of typeLine(line, typingDelay)) {
        yield { type: 'char', content: char }
      }
    }
  }
  await wait(typingDelay * 10)
  yield { type: 'char', content: '\n' }
  await wait(typingDelay * 10)
}

// After decillion iterations, start over again. What else can you do?
// According to Wikipedia (https://en.wikipedia.org/wiki/Names_of_large_numbers),
// numbers after decillion are not widely standardized, so it's perhaps the
// best time to start over.
const loopLength = 1_000_000_000_000_000_000_000_000_000_000_000_000_000_000n

export async function* sing(
  song: (iteration: bigint) => Promise<SongPart[]>,
  pace: Pace,
  /** Where to begin: 0 for the first time, later after a sleep. */
  from = 0n,
): AsyncGenerator<SingEvent> {
  let iteration = from
  let nextParts: Promise<SongPart[]> = song(iteration)
  while (true) {
    const currentParts = await nextParts
    iteration++
    nextParts = song(iteration)

    yield { type: 'iteration', content: iteration }
    for (const part of currentParts) {
      for await (const event of singPart(part, pace)) {
        yield event
      }
    }

    if (iteration === loopLength) {
      iteration = 0n
    }
  }
}
