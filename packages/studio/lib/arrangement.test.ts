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

  it('allows new region names, new active parts, consecutive bridges, and drone/pulse tracks while refusing unknown parts, unsupported tracks, or a key placed under two tempi', () => {
    const activeParts = new Set(records.filter(({ state }) => state === 'active').map(({ part }) => part.id))
    const turns = arrangementOf('tempo-turns')
    expect(unmet(turns, theSong, activeParts)).toBeUndefined()
    expect(unmet({ ...walked(2), tempo: [{ bpm: 96 }] }, theSong, activeParts)).toBeUndefined()
    expect(unmet({ ...walked(2), blocks: [{ track: 'bed', key: 'k', from: { edge: 'start' }, to: { edge: 'end' }, fadeIn: 2 }] }, theSong, activeParts)).toBeUndefined()
    // new region names, active parts (pre-chorus, spoken, interlude, refrain, silence, outro), consecutive bridges, and drone/pulse/drums tracks are now supported
    const expanded = walked(1)
    expanded.instances.splice(1, 0, { name: 'pre-1', part: 'pre-chorus' }, { name: 'spoke-1', part: 'spoken' }, { name: 'gap', part: 'silence' }, { name: 'finale', part: 'outro' }, { name: 'coda', part: 'refrain' })
    expanded.tracks = ['voice', 'bed', 'guide', 'drone', 'pulse', 'drums']
    expect(unmet(expanded, theSong, activeParts)).toBeUndefined()
    const twoBridges = walked(1)
    twoBridges.instances.splice(2, 0, { name: 'bridge-2', part: 'bridge' })
    expect(unmet(twoBridges, theSong, activeParts)).toBeUndefined()
    // one key placed under two different tempi (even mood vs a number) is still refused on tempo-bound tracks
    const mixedTempo = {
      ...turns,
      blocks: turns.blocks!.map((block) => (block.key === 'voice:chorus:96' ? { ...block, key: 'voice:chorus' } : block)),
    }
    expect(unmet(mixedTempo, theSong, activeParts)).toContain('placed under two tempi')
    // unknown part or unsupported track is refused plainly
    const odd = walked(2)
    odd.instances = odd.instances.map((one, i) => (i === 0 ? { ...one, part: 'unknown-part' } : one))
    expect(unmet(odd, theSong, activeParts)).toContain('not among the active parts')
    expect(unmet({ ...walked(1), tracks: ['brass'] }, theSong, activeParts)).toContain('cannot make yet')
    // the Mood's own tempo is the Song's one tempo
    expect(unmet({ ...walked(2), tempo: [{ bpm: 'mood' }] }, theSong, activeParts)).toBeUndefined()
  })

  it('makes regions in another order than the Song as it always was lays one: the Studio makes the Song from the timeline', () => {
    const other = walked(2)
    const [a, b] = [other.instances[0]!, other.instances[1]!]
    other.instances[0] = b
    other.instances[1] = a
    expect(unmet(other, theSong)).toBeUndefined()
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
      { arrangement: theSong, title: 'The Song as it always was', iterations: 2, weight: 2 },
      { arrangement: alt, title: 'Alt', iterations: 1, weight: 1 },
      { arrangement: never, title: 'Never', iterations: 3, weight: 0 },
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
    expect(() => drawFrom([{ arrangement: theSong, title: 'The Song as it always was', iterations: 2, weight: 0 }], '1')).toThrow('no active, makeable Arrangement')
  })

  it('poolOf keeps active, makeable, positive-weight Arrangements (40/20/10/10/10/10 split, excluding tempo-turns at 0)', async () => {
    const pool = await poolOf()
    expect(pool.map(({ arrangement, weight }) => [arrangement.id, weight])).toEqual([
      ['the-ascent', 2],
      ['the-clockwork', 2],
      ['the-long-breath', 4],
      ['the-nocturne', 2],
      ['the-song', 8],
      ['the-triptych', 2],
    ])
    for (const id of ['the-ascent', 'the-nocturne', 'the-clockwork', 'the-triptych']) {
      const one = await chosen(id)
      expect(one.iterations).toBe(1)
      expect(takeOf(one)).toEqual({ id, iterations: 1 })
    }
    const pick = await chooser()
    const counts = new Map<string, number>()
    for (let s = 1n; s <= 1000n; s++) {
      const one = pick.take(s)
      expect(pick.take(s)).toEqual(one)
      counts.set(one.id, (counts.get(one.id) ?? 0) + 1)
      if (one.id === 'the-song') expect(one.iterations).toBe(2)
      else expect(one.iterations).toBe(1)
    }
    expect([...counts.keys()].sort()).toEqual([
      'the-ascent',
      'the-clockwork',
      'the-long-breath',
      'the-nocturne',
      'the-song',
      'the-triptych',
    ])
    // 40% the-song, 20% the-long-breath, 10% each of the four newer arrangements
    expect(counts.get('the-song')!).toBeGreaterThan(340)
    expect(counts.get('the-song')!).toBeLessThan(460)
    expect(counts.get('the-long-breath')!).toBeGreaterThan(150)
    expect(counts.get('the-long-breath')!).toBeLessThan(250)
    for (const id of ['the-ascent', 'the-clockwork', 'the-nocturne', 'the-triptych']) {
      expect(counts.get(id)!).toBeGreaterThan(65)
      expect(counts.get(id)!).toBeLessThan(140)
    }
  })
})
