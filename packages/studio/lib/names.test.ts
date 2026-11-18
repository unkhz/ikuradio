// Naming the kept: each name is written as it comes, each silence is told,
// and the run stops when the silence goes on.

import { describe, expect, it } from 'bun:test'
import { slugOf, type ArchiveStore, type Session } from 'archive'
import { Silence } from 'song'

import { nameKept, verifyNamed, wordsOf } from './names.js'

const session = (song: string, name?: string): Session =>
  ({
    song,
    name,
    mood: ['mist rising'],
    iterations: [{ parts: [{ lines: [{ text: `the ${song} words are sung` }] }] }],
  }) as unknown as Session

const store = (sessions: Session[], worn: Record<string, string> = {}, onPut?: () => void): ArchiveStore =>
  ({
    index: async () => ({ songs: sessions.map(({ song }) => song) }),
    names: async () => worn,
    session: async (song: string) => sessions.find(({ song: n }) => n === song),
    putSession: async () => onPut?.(),
  }) as unknown as ArchiveStore

describe('wordsOf', () => {
  it('gathers the words of the first iteration, line by line', () => {
    expect(wordsOf(session('7'))).toBe('the 7 words are sung')
  })
})

describe('nameKept', () => {
  it('names every Song without a name, and writes each name to the Archive', async () => {
    const kept = [session('1'), session('2'), session('3')]
    const names = ['A name', 'B name', 'C name']
    let asked = 0
    let written = 0
    const { named, unmarked } = await nameKept(store(kept, {}, () => written++), {
      quiet: true,
      name: async () => names[asked++],
    })
    expect(named).toBe(3)
    expect(unmarked).toEqual([])
    expect(written).toBe(3)
    expect(kept.map(({ name }) => name)).toEqual(names)
  })

  it('leaves the Songs that already have a name', async () => {
    const kept = [session('1', 'Kept'), session('2')]
    let asked = 0
    const { named } = await nameKept(store(kept), {
      quiet: true,
      name: async () => {
        asked++
        return 'A name'
      },
    })
    expect(named).toBe(1)
    expect(asked).toBe(1)
    expect(kept[1].name).toBe('A name')
  })

  it('tells of each Song that is not named, and goes on, though the mind answers and no answer is a name', async () => {
    const kept = [session('1'), session('2'), session('3'), session('4')]
    let asked = 0
    const { named, unmarked } = await nameKept(store(kept), {
      quiet: true,
      name: async () => {
        asked++
        return undefined
      },
    })
    expect(named).toBe(0)
    expect(unmarked).toEqual(['1', '2', '3', '4'])
    expect(asked).toBe(4)
  })

  it('stops when the mind falls silent for three Songs in a row', async () => {
    const kept = [session('1'), session('2'), session('3'), session('4')]
    let asked = 0
    await expect(
      nameKept(store(kept), {
        quiet: true,
        name: async () => {
          asked++
          throw new Silence('the mind fell silent')
        },
      }),
    ).rejects.toThrow(/three Songs in a row/)
    expect(asked).toBe(3)
  })

  it('counts the silences anew, when a name comes between them', async () => {
    const kept = [session('1'), session('2'), session('3'), session('4'), session('5'), session('6')]
    let asked = 0
    await expect(
      nameKept(store(kept), {
        quiet: true,
        name: async () => {
          asked++
          if (asked === 3) return 'A name'
          throw new Silence('the mind fell silent')
        },
      }),
    ).rejects.toThrow(/three Songs in a row/)
    expect(asked).toBe(6)
  })

  it('tells of a Song that is listed, and not there, and goes on', async () => {
    const kept = [session('1'), session('3')]
    const listed = {
      index: async () => ({ songs: ['1', '2', '3'] }),
      names: async () => ({}),
      session: async (song: string) => kept.find(({ song: n }) => n === song),
      putSession: async () => {},
    } as unknown as ArchiveStore
    let asked = 0
    const { named, unmarked, missing } = await nameKept(listed, {
      quiet: true,
      name: async () => `a name ${asked++}`,
    })
    expect(named).toBe(2)
    expect(unmarked).toEqual([])
    expect(missing).toEqual(['2'])
    expect(asked).toBe(2)
  })

  it('asks the Archive only for the Songs that wear no slug', async () => {
    const kept = [session('1'), session('2'), session('3'), session('4', 'A name'), session('5', 'B name')]
    const worn: Record<string, string> = {}
    worn[slugOf('A name')] = '4'
    worn[slugOf('B name')] = '5'
    const asked: string[] = []
    const listing = {
      index: async () => ({ songs: kept.map(({ song }) => song) }),
      names: async () => worn,
      session: async (song: string) => {
        asked.push(song)
        return kept.find(({ song: n }) => n === song)
      },
      putSession: async () => {},
    } as unknown as ArchiveStore
    let named = 0
    await nameKept(listing, { quiet: true, name: async () => `a name ${++named}` })
    expect(named).toBe(3)
    expect(asked).toEqual(['1', '2', '3'])
  })

  it('tells the mind the names already worn, from the slugs that wear them', async () => {
    const kept = [session('1')]
    const worn: Record<string, string> = {}
    worn[slugOf('Hollow Death')] = '2'
    const listing = {
      index: async () => ({ songs: kept.map(({ song }) => song) }),
      names: async () => worn,
      session: async (song: string) => kept.find(({ song: n }) => n === song),
      putSession: async () => {},
    } as unknown as ArchiveStore
    let seen: readonly string[] = []
    await nameKept(listing, {
      quiet: true,
      name: async (_words, _weather, _taken, own) => {
        seen = own ?? []
        return undefined
      },
    })
    expect(seen).toContain(slugOf('Hollow Death').replaceAll('-', ' '))
  })
})

describe('verifyNamed', () => {
  it('reports the Songs without a name, and the names worn by another', async () => {
    const kept = [session('1'), session('2', 'Hollow Death')]
    const worn: Record<string, string> = {}
    worn[slugOf('Hollow Death')] = '3'
    const { unmarked, mismatched } = await verifyNamed(store(kept, worn))
    expect(unmarked).toEqual(['1'])
    expect(mismatched).toEqual(['2'])
  })

  it('is silent when every Song has a name, and no slug is worn by two', async () => {
    const kept = [session('1', 'A name'), session('2', 'B name')]
    const worn: Record<string, string> = {}
    worn[slugOf('A name')] = '1'
    worn[slugOf('B name')] = '2'
    const { unmarked, mismatched } = await verifyNamed(store(kept, worn))
    expect(unmarked).toEqual([])
    expect(mismatched).toEqual([])
  })

  it('reports a Song that is listed, and not there, as without a name', async () => {
    const kept = [session('1', 'A name')]
    const worn: Record<string, string> = {}
    worn[slugOf('A name')] = '1'
    const listed = {
      index: async () => ({ songs: ['1', '2'] }),
      names: async () => worn,
      session: async (song: string) => kept.find(({ song: n }) => n === song),
      putSession: async () => {},
    } as unknown as ArchiveStore
    const { unmarked } = await verifyNamed(listed)
    expect(unmarked).toEqual(['2'])
  })
})
