import { describe, expect, it } from 'bun:test'
import { roaming, type Progression } from 'melody'
import type { Session } from 'archive'
import { chordsIn, favouritesOf, progressionOf, type Critic, type Finding } from './progression.js'

/** A Session with one iteration of verse, bridge, chorus, verse, and the given guides. */
const session = (guides: Partial<NonNullable<Session['guides']>[number]>[], mode = 'aeolian'): Session =>
  ({
    song: '1',
    mode,
    iterations: [
      {
        at: 0,
        seconds: 100,
        parts: [
          { type: 'verse', at: 0, seconds: 30, lines: [] },
          { type: 'bridge', at: 30, seconds: 10, lines: [] },
          { type: 'chorus', at: 40, seconds: 30, lines: [] },
          { type: 'verse', at: 70, seconds: 30, lines: [] },
        ],
      },
      { at: 100, seconds: 100, parts: [] },
    ],
    guides: guides.map((g) => ({ kind: 'guide', id: 'x', seconds: 30, score: { bpm: 80, notes: [] }, ...g })),
  }) as never

const chords = (roots: number[]) => roots.map((root, i) => ({ at: i * 4, beats: 4, root, bass: root - 7, upper: root, function: 'home' as const }))

describe('favouritesOf', () => {
  it('reads Songs and precise sections, in the order written, leaving out what it cannot read', () => {
    const critic: Critic = { favorites: { chorus: [1, '45:3', 'nonsense', ' 7 '] } }
    expect(favouritesOf(critic, 'chorus')).toEqual([
      { song: '1', name: '1' },
      { song: '45', section: 3, name: '45:3' },
      { song: '7', name: '7' },
    ])
    expect(favouritesOf(critic, 'verse')).toEqual([])
    expect(favouritesOf(undefined, 'verse')).toEqual([])
  })
})

describe('chordsIn', () => {
  it('takes a guide with chords as it is', () => {
    expect(chordsIn(session([{ part: 'chorus', at: 40, chords: chords([0, 5, 3, 4]) }]), 'chorus', 0)).toEqual([0, 5, 3, 4])
  })

  it('hears a guide with only a hum as chords, the same every time', () => {
    const hum = { part: 'chorus' as const, at: 40, score: { bpm: 80, notes: [[57, 2], [60, 2], [55, 2], [62, 2], [53, 2], [57, 2], [64, 2], [59, 2]] as [number, number][] } }
    expect(chordsIn(session([hum]), 'chorus', 0)).toEqual([0, 6, 5, 4])
  })

  it('takes each section by place, the last again where the favourite has fewer', () => {
    const s = session([
      { part: 'verse', at: 0, chords: chords([0, 3]) },
      { part: 'verse', at: 70, chords: chords([0, 6]) },
    ])
    expect(chordsIn(s, 'verse', 0)).toEqual([0, 3])
    expect(chordsIn(s, 'verse', 1)).toEqual([0, 6])
    expect(chordsIn(s, 'verse', 4)).toEqual([0, 6])
  })

  it('without a guide of its own, takes the nearest of the part in the same iteration, then any', () => {
    const firstOnly = session([
      { part: 'verse', at: 0, chords: chords([0, 3]) },
      { part: 'verse', at: 170, chords: chords([0, 2]) },
    ])
    expect(chordsIn(firstOnly, 'verse', 1)).toEqual([0, 3])
    const laterOnly = session([{ part: 'verse', at: 170, chords: chords([0, 2]) }])
    expect(chordsIn(laterOnly, 'verse', 0)).toEqual([0, 2])
  })

  it('gives nothing with no guide of the part, a mode it does not know, or a hum that is all rest', () => {
    expect(chordsIn(session([{ part: 'verse', at: 0, chords: chords([0]) }]), 'chorus', 0)).toBeUndefined()
    expect(chordsIn(session([{ part: 'chorus', at: 40, chords: chords([0]) }], 'klingon'), 'chorus', 0)).toBeUndefined()
    expect(chordsIn(session([{ part: 'chorus', at: 40, score: { bpm: 80, notes: [[0, 8]] } }]), 'chorus', 0)).toBeUndefined()
  })
})

describe('progressionOf', () => {
  const home: Progression = { ...roaming, style: 'known', known: { from: 'scientist' } }
  const finder = (favorites: Critic['favorites'], sessions: Record<string, Session | 'unreadable'>) => {
    const warnings: string[] = []
    const find: Finding = {
      critic: async () => ({ favorites }),
      session: async (song) => {
        const s = sessions[song]
        if (s === 'unreadable') throw new Error('unreadable')
        return s
      },
      warn: (message) => warnings.push(message),
    }
    return { find, warnings }
  }
  const where = { part: 'chorus' as const, place: 0, song: '300' }

  it('leaves a roaming Setting, and a known one with its roots, as they are', async () => {
    const { find } = finder({}, {})
    expect(await progressionOf(roaming, where, find)).toBe(roaming)
    const classic: Progression = { ...roaming, style: 'known', known: { from: 'classic:ii-V-I', roots: [1, 4, 0] } }
    expect(await progressionOf(classic, where, find)).toBe(classic)
  })

  it('comes home to a favourite, naming where the roots came from', async () => {
    const { find, warnings } = finder({ chorus: [1] }, { 1: session([{ part: 'chorus', at: 40, chords: chords([0, 5, 2, 4]) }]) })
    expect(await progressionOf(home, where, find)).toEqual({ ...home, known: { from: 'scientist:1', roots: [0, 5, 2, 4] } })
    expect(warnings).toEqual([])
  })

  it('passes over a favourite it cannot read, or one with nothing usable, for the next', async () => {
    const good = session([{ part: 'chorus', at: 40, chords: chords([0, 3, 4]) }])
    const { find, warnings } = finder({ chorus: [2, 3, 4] }, { 2: 'unreadable', 3: session([]), 4: good })
    const used = await progressionOf(home, where, find)
    expect(used.known?.from).toBe('scientist:4')
    expect(warnings.length).toBeLessThanOrEqual(2)
  })

  it('roams with none left, and says so', async () => {
    const { find, warnings } = finder({ chorus: [2] }, {})
    expect(await progressionOf(home, where, find)).toEqual({ style: 'roaming', temperature: home.temperature, pull: home.pull, unfound: 'scientist' })
    expect(warnings.at(-1)).toContain('roams')
  })

  it('picks the same favourite for the same Song every time', async () => {
    const sessions = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, session([{ part: 'chorus', at: 40, chords: chords([0, n % 7, 4]) }])]))
    const { find } = finder({ chorus: [1, 2, 3, 4, 5] }, sessions)
    const a = await progressionOf(home, where, find)
    expect(await progressionOf(home, where, find)).toEqual(a)
    const picked = new Set(await Promise.all(['1', '2', '3', '4', '5', '6', '7', '8'].map(async (song) => (await progressionOf(home, { ...where, song }, find)).known?.from)))
    expect(picked.size).toBeGreaterThan(1)
  })
})
