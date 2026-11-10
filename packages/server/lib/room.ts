// The room the song sings into.
//
// Whoever is in the room hears what is sung, as it is sung. Whoever is not
// does not, and nothing is kept for them. The room remembers only the
// iteration being sung right now, so that someone who walks in halfway
// through a verse is not left wondering where they are: they are shown the
// weather and the words so far, and then they hear the rest.
//
// The song does not wait for anyone. If nobody is in the room, it sings to
// the walls. If a listener cannot keep up, they are let go.

/** Anything that can be written to and can go away: an HTTP response, in practice. */
export type Listener = {
  write(chunk: string): boolean
  end(): void
  /** How much has been written but not yet delivered. */
  readonly writableLength: number
  on(event: 'close', handler: () => void): unknown
}

/** A listener this far behind is let go. */
const patience = 1024 * 1024

/**
 * What the song says to the room is a stream of utterances, one per line:
 *
 *   a single character, or <br>    the words, as they are typed
 *   part:verse, part:chorus        a part of the song begins
 *   about:{...}                    which iteration this is, in which Mood, by whom
 *   weather:...                    the Mood a Song grows in, to be shown
 *   score:{...}                    an iteration's recordings and their moments, ahead of time
 *   begin:<iteration>              this moment is that iteration's beginning
 *   play:<recording>               play this now
 *   rest:<words>                   the song is stopping, and says why
 */
const utter = (chunks: readonly string[]) =>
  chunks.map((chunk) => chunk + '\n').join('')

/**
 * Utterances that are about sound and time, not words: a recording to play,
 * the score of an iteration, the moment one begins. They are heard once,
 * live, and never remembered with the words.
 */
const isSound = (chunk: string) => /^(play|score|begin|rest):/.test(chunk)

export class Room {
  private listeners = new Set<Listener>()
  /** What a newcomer is shown before they hear anything. */
  private prelude: string[] = []
  /** The words of the iteration being sung, so far. */
  private recent: string[] = []
  /** The score of the iteration that comes next, once it has been sung ahead. */
  private upcoming: string | undefined

  get size() {
    return this.listeners.size
  }

  /**
   * Someone walks in. They are shown where the song is, and the score of
   * what comes next if it is already known, and then they hear it.
   */
  enter(listener: Listener) {
    const memory = utter([
      ...this.prelude,
      ...this.recent,
      ...(this.upcoming ? [this.upcoming] : []),
    ])
    if (memory) listener.write(memory)
    this.listeners.add(listener)
    listener.on('close', () => this.listeners.delete(listener))
  }

  /** The song sings something. Everyone in the room hears it. */
  say(chunk: string) {
    if (!isSound(chunk)) this.recent.push(chunk)
    const utterance = utter([chunk])
    for (const listener of this.listeners) {
      if (listener.writableLength > patience) {
        // too far behind to ever catch up
        this.listeners.delete(listener)
        listener.end()
        continue
      }
      listener.write(utterance)
    }
  }

  /** Everyone is shown out, and the room is empty. */
  close() {
    for (const listener of this.listeners) listener.end()
    this.listeners.clear()
  }

  /**
   * The score of the next iteration is ready, long before it begins. Everyone
   * in the room is given it now, so they can prepare to hear it on time, and
   * so is anyone who walks in before it begins.
   */
  announce(score: string) {
    this.upcoming = score
    this.say(score)
  }

  /**
   * A new iteration begins, and the room forgets the last one. `prelude` is
   * what a newcomer will be shown from now on, before the words: the
   * weather the song is in.
   */
  turnPage(prelude: readonly string[]) {
    this.prelude = [...prelude]
    this.recent = []
    this.upcoming = undefined
  }
}
