import { describe, expect, it } from 'bun:test'
import { readArrangements, readParts, readTracks, type Arrangement } from 'parts'
import { chosen, iterationsOfArrangement, takeOf, unmet } from './arrangement.js'

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

  it('refuses what a Session cannot say yet: another tempo, free time, a fade in, a part that is not a verse, a chorus or a bridge', () => {
    const turns = arrangementOf('tempo-turns')
    // it has names the Song has; what stops it is what it asks
    expect(unmet(turns, theSong)).toContain('free time')
    expect(unmet({ ...walked(2), tempo: [{ bpm: 96 }] }, theSong)).toContain('changes the tempo')
    expect(unmet({ ...walked(2), tempo: [{ bpm: 'mood' }, { region: 'chorus', hearing: 2, bpm: 'mood' }] }, theSong)).toContain('changes the tempo')
    expect(unmet({ ...walked(2), blocks: [{ track: 'bed', key: 'k', from: { edge: 'start' }, to: { edge: 'end' }, fadeIn: 2 }] }, theSong)).toContain('fades in')
    const odd = walked(2)
    odd.instances = odd.instances.map((one, i) => (i === 0 ? { ...one, part: 'refrain' } : one))
    expect(unmet(odd, theSong)).toContain('a Session can say only a verse, a chorus or a bridge')
    // the Mood's own tempo is the Song's one tempo
    expect(unmet({ ...walked(2), tempo: [{ bpm: 'mood' }] }, theSong)).toBeUndefined()
  })

  it('refuses regions in another order than the Song as it always was lays one, until the Studio makes the Song from the timeline', () => {
    const other = walked(2)
    const [a, b] = [other.instances[0]!, other.instances[1]!]
    other.instances[0] = b
    other.instances[1] = a
    expect(unmet(other, theSong)).toContain('iteration 1 is not laid as the-song lays one')
  })
})

describe('the Arrangement chosen, read as the Composer reads it', () => {
  it('is the Song as it always was, two iterations long, taken as that', async () => {
    const song = await chosen('the-song')
    expect(song.iterations).toBe(2)
    expect(takeOf(song)).toEqual({ id: 'the-song', iterations: 2 })
  })

  it('is refused, plainly, before anything is woken: not there, or one that cannot be made yet', async () => {
    await expect(chosen('nothing')).rejects.toThrow('the Arrangement "nothing" cannot be read')
    await expect(chosen('tempo-turns')).rejects.toThrow('the Arrangement "tempo-turns" cannot be made yet: its region "bridge-2" is in free time')
  })
})
