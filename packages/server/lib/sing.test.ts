import {
  sing,
  typingMoments,
  type Clock,
  type SingEvent,
  type TimedPart,
} from './sing.js'

/** A clock that only moves when it is waited on, and remembers when things happened. */
class Metronome implements Clock {
  time = 1000
  now() {
    return this.time
  }
  async until(moment: number) {
    this.time = Math.max(this.time, moment)
  }
}

const part = (
  type: 'verse' | 'chorus',
  index: number,
  lines: string[],
  seconds = 6,
): TimedPart => ({
  type,
  index,
  content: lines.join('\n'),
  timing: lines.map(() => ({ seconds, enters: 0.3, voiced: 5 })),
})

async function listen(
  song: (i: bigint) => Promise<TimedPart[]>,
  clock: Metronome,
  until: (e: SingEvent) => boolean,
) {
  const heard: { at: number; event: SingEvent }[] = []
  for await (const event of sing(song, 0n, clock)) {
    heard.push({ at: clock.now(), event })
    if (until(event)) break
  }
  return heard
}

describe('sing', () => {
  const song = async (): Promise<TimedPart[]> => [
    part('verse', 0, ['la la la', 'laa laa']),
    part('chorus', 1, ['this is the song, iteration one']),
  ]

  it('begins every line exactly where the music puts it, iteration after iteration', async () => {
    const clock = new Metronome()
    const heard = await listen(
      song,
      clock,
      (e) => e.type === 'iteration' && e.content === 101n,
    )
    const lines = heard.filter(({ event }) => event.type === 'line')
    // three lines of six seconds per iteration, for a hundred iterations, without drifting
    expect(lines).toHaveLength(300)
    lines.forEach(({ at }, i) => expect(at).toBe(1000 + i * 6000))
  })

  it('types every line within the time it is sung', async () => {
    const clock = new Metronome()
    const heard = await listen(
      song,
      clock,
      (e) => e.type === 'part' && e.content === 'chorus',
    )
    const verse = heard.filter(({ at }) => at >= 1000 && at < 7000)
    const chars = verse.filter(({ event }) => event.type === 'char')
    expect(chars.map(({ event }) => event.content).join('')).toBe('la la la\n')
    for (const { at } of chars) {
      expect(at).toBeGreaterThanOrEqual(1300)
      expect(at).toBeLessThanOrEqual(6300)
    }
  })

  it('holds a fermata when the next iteration is late, then keeps the beat from there', async () => {
    const clock = new Metronome()
    let calls = 0
    const late = (): Promise<TimedPart[]> => {
      // the third iteration is ready a minute after it was due, at 37 seconds
      if (calls++ !== 2) return song()
      return new Promise((resolve) =>
        setTimeout(() => {
          clock.time = 37_000 + 60_000
          resolve(song())
        }, 0),
      )
    }
    const heard = await listen(
      late,
      clock,
      (e) => e.type === 'iteration' && e.content === 4n,
    )
    const fermata = heard.find(({ event }) => event.type === 'fermata')
    expect(fermata?.event.content).toBeCloseTo(60, 1)
    const lines = heard
      .filter(({ event }) => event.type === 'line')
      .map(({ at }) => at)
    // the second iteration was on time; the third began a minute late, and kept its own beat
    expect(lines.slice(3, 6)).toEqual([19_000, 25_000, 31_000])
    expect(lines.slice(6, 9)).toEqual([97_000, 103_000, 109_000])
  })
})

describe('typingMoments', () => {
  it('never lets a character overtake its neighbour', () => {
    for (let i = 0; i < 100; i++) {
      const moments = typingMoments(
        'a song, that never ends, and on',
        4,
        `${i}`,
      )
      moments.slice(1).forEach((m, k) => expect(m).toBeGreaterThan(moments[k]))
    }
  })

  it('waits longer after a comma', () => {
    const [a, comma, b] = typingMoments('a,b', 1, 'x')
    expect(b - comma).toBeGreaterThan(5 * (comma - a))
  })

  it('ends the line when the voice ends', () => {
    expect(typingMoments('la la', 3, 'x').at(-1)).toBe(3000)
  })
})
