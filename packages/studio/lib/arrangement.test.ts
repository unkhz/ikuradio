import { describe, expect, it } from 'bun:test'
import { readArrangements, readParts, readTracks, type Arrangement } from 'parts'
import { chosen, chooser, drawFrom, iterationsOfArrangement, poolOf, takeOf, unmet, type Weighted } from './arrangement.js'

const records = await readParts()
const tracks = await readTracks()
const found = await readArrangements(records, undefined, tracks)
const arrangementOf = (id: string) => found.find(({ arrangement }) => arrangement.id === id)!.arrangement
const theSong = arrangementOf('the-song')

/** The Song as it always was, walked `passes` times, with a turn before each pass after the first. */
const walked = (passes: number): Arrangement => {
  const names = theSong.instances.slice(0, 10)
  return {
    id: 'walked',
    title: 'Walked',
    instances: Array.from({ length: passes }, () => names).flat(),
    turns: Array.from({ length: passes - 1 }, (_, k) => ({ region: 'verse-1', hearing: k + 2, edge: 'start' as const })),
  }
}

describe('how long an Arrangement makes a Song', () => {
  it('is its turns and one: two for the Song as it always was, one for none, three for two', () => {
    expect(iterationsOfArrangement(theSong)).toBe(2)
    expect(iterationsOfArrangement(walked(1))).toBe(1)
    expect(iterationsOfArrangement(walked(3))).toBe(3)
  })
})

describe('what the Studio cannot yet make', () => {
  it('is nothing for the Song as it always was, and for it walked another number of times', () => {
    expect(unmet(theSong, theSong)).toBeUndefined()
    expect(unmet(walked(1), theSong)).toBeUndefined()
    expect(unmet(walked(3), theSong)).toBeUndefined()
  })

  it('refuses a name the Song as it always was does not have, plainly', () => {
    const other = walked(2)
    other.instances = other.instances.map((one, i) => (i === 3 ? { ...one, name: 'coda' } : one))
    expect(unmet(other, theSong)).toContain('the name "coda", which the-song does not have')
  })

  it('accepts tempo changes, free time and fadeIn (step 6), and still refuses unknown part types or a key placed under two tempi', () => {
    const turns = arrangementOf('tempo-turns')
    expect(unmet(turns, theSong)).toBeUndefined()
    expect(unmet({ ...walked(2), tempo: [{ bpm: 96 }] }, theSong)).toBeUndefined()
    expect(unmet({ ...walked(2), blocks: [{ track: 'bed', key: 'k', from: { edge: 'start' }, to: { edge: 'end' }, fadeIn: 2 }] }, theSong)).toBeUndefined()
    // one key placed under two different tempi (even mood vs a number) is refused
    const mixedTempo = {
      ...turns,
      blocks: turns.blocks!.map((block) => (block.key === 'voice:chorus:96' ? { ...block, key: 'voice:chorus' } : block)),
    }
    expect(unmet(mixedTempo, theSong)).toContain('placed under two tempi')
    const odd = walked(2)
    odd.instances = odd.instances.map((one, i) => (i === 0 ? { ...one, part: 'refrain' } : one))
    expect(unmet(odd, theSong)).toContain('a Session can say only a verse, a chorus or a bridge')
    // the Mood's own tempo is the Song's one tempo
    expect(unmet({ ...walked(2), tempo: [{ bpm: 'mood' }] }, theSong)).toBeUndefined()
  })

  it('makes regions in another order than the Song as it always was lays one: the Studio makes the Song from the timeline', () => {
    const other = walked(2)
    const [a, b] = [other.instances[0]!, other.instances[1]!]
    other.instances[0] = b
    other.instances[1] = a
    expect(unmet(other, theSong)).toBeUndefined()
  })

  it('refuses two bridges in a row, which would be sung as one section', () => {
    const other = walked(1)
    other.instances.splice(2, 0, { name: 'bridge-2', part: 'bridge' })
    expect(unmet(other, theSong)).toContain('two bridges in a row')
  })
})

describe('the Arrangement chosen, read as the Composer reads it', () => {
  it('is the Song as it always was, two iterations long, taken as that', async () => {
    const song = await chosen('the-song')
    expect(song.iterations).toBe(2)
    expect(takeOf(song)).toEqual({ id: 'the-song', iterations: 2 })
  })

  it('accepts tempo-turns (1 iteration) and refuses an unknown Arrangement plainly before anything is woken', async () => {
    await expect(chosen('nothing')).rejects.toThrow('the Arrangement "nothing" cannot be read')
    const turns = await chosen('tempo-turns')
    expect(turns.iterations).toBe(1)
    expect(takeOf(turns)).toEqual({ id: 'tempo-turns', iterations: 1 })
  })
})

describe('weighted deterministic Arrangement selection', () => {
  it('draws deterministically from a weighted pool (~33% for 2:1 weights), ignoring weight 0', () => {
    const alt = { ...walked(1), id: 'alt', title: 'Alt' }
    const never = { ...walked(3), id: 'never', title: 'Never' }
    const pool: Weighted[] = [
      { arrangement: theSong, iterations: 2, weight: 2 },
      { arrangement: alt, iterations: 1, weight: 1 },
      { arrangement: never, iterations: 3, weight: 0 },
    ]
    let altCount = 0
    for (let s = 1; s <= 300; s++) {
      const a = drawFrom(pool, `${s}`)
      const b = drawFrom(pool, `${s}`)
      expect(a.arrangement.id).toBe(b.arrangement.id)
      expect(a.arrangement.id).not.toBe('never')
      if (a.arrangement.id === 'alt') altCount++
    }
    expect(altCount).toBeGreaterThan(75)
    expect(altCount).toBeLessThan(125)
  })

  it('refuses an empty or zero-weight pool', () => {
    expect(() => drawFrom([], '1')).toThrow('no active, makeable Arrangement')
    expect(() => drawFrom([{ arrangement: theSong, iterations: 2, weight: 0 }], '1')).toThrow('no active, makeable Arrangement')
  })

  it('poolOf keeps active, makeable, positive-weight Arrangements (the-song at weight 2, the-long-breath at weight 1, not tempo-turns at weight 0)', async () => {
    const pool = await poolOf()
    expect(pool.map(({ arrangement, weight }) => [arrangement.id, weight])).toEqual([
      ['the-long-breath', 1],
      ['the-song', 2],
    ])
    const pick = await chooser()
    const drawn = new Set<string>()
    let longBreath = 0
    for (let s = 1n; s <= 300n; s++) {
      const one = pick.take(s)
      expect(pick.take(s)).toEqual(one)
      drawn.add(one.id)
      if (one.id === 'the-long-breath') {
        expect(one.iterations).toBe(1)
        longBreath++
      } else {
        expect(one).toEqual({ id: 'the-song', iterations: 2 })
      }
    }
    expect([...drawn].sort()).toEqual(['the-long-breath', 'the-song'])
    // weight 1 of 3 (~33%)
    expect(longBreath).toBeGreaterThan(75)
    expect(longBreath).toBeLessThan(125)
  })
})
