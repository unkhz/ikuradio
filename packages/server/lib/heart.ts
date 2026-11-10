// The heart of the song keeps its pulse: when each iteration began, how
// long it should have lasted, how often the song has stumbled or held its
// breath. Anyone outside can ask for the pulse, and be told whether the
// song is singing.
//
// A song is alive while its iterations keep beginning, roughly when they
// should. A long fermata is still life: the song is waiting for its mind.
// But an iteration that should have ended long ago, with no next one
// begun, is a heart that has missed too many beats.

export type Beat = {
  /** The iteration that began, counted from one. */
  iteration: bigint
  /** How long the music says it lasts, in seconds. */
  seconds: number
  /** The Mood it is sung in. */
  mood: string
}

export type Pulse = {
  alive: boolean
  /** Why the heart thinks so, in a few words. */
  because: string
  iteration?: string
  mood?: string
  /** How long ago the current iteration began, in seconds. */
  beganAgo?: number
  /** How long the current iteration should last, in seconds. */
  lasts?: number
  listeners: number
  stumbles: number
  fermatas: number
  /** How long the song has been awake, in seconds. */
  awake: number
}

/** How long the song may be quiet after waking before its first iteration, in seconds. */
const waking = 15 * 60
/** How long past its end an iteration may go on before the next must have begun, in seconds. */
const grace = 15 * 60

export class Heart {
  private woke: number
  private last?: { beat: Beat; at: number }
  private stumbled = 0
  private held = 0

  constructor(private now: () => number = Date.now) {
    this.woke = now()
  }

  beat(beat: Beat) {
    this.last = { beat, at: this.now() }
  }

  stumble() {
    this.stumbled++
  }

  fermata() {
    this.held++
  }

  pulse(listeners = 0): Pulse {
    const now = this.now()
    const awake = (now - this.woke) / 1000
    const common = {
      listeners,
      stumbles: this.stumbled,
      fermatas: this.held,
      awake: Math.round(awake),
    }
    if (!this.last) {
      const alive = awake < waking
      return {
        ...common,
        alive,
        because: alive
          ? 'waking up: the first iteration is still being written'
          : 'it woke long ago and has not begun to sing',
      }
    }
    const { beat, at } = this.last
    const beganAgo = (now - at) / 1000
    const overdue = beganAgo - beat.seconds
    const alive = overdue < grace
    return {
      ...common,
      alive,
      because: alive
        ? overdue > 0
          ? 'holding its breath: the next iteration is late'
          : 'singing'
        : 'an iteration that should have ended long ago, and nothing after it',
      iteration: `${beat.iteration}`,
      mood: beat.mood,
      beganAgo: Math.round(beganAgo),
      lasts: Math.round(beat.seconds),
    }
  }
}
