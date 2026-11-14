// The cache is tested against a real Postgres, when one is given by its
// unix socket in CACHE_TEST_SOCKET (on the dev box, a throwaway one). Its
// tables are dropped and made again for every test. With none given, only
// the cache that cannot be reached is tested.
import { beforeEach, describe, expect, it } from 'bun:test'
import type { Session } from 'archive'
import { cachedFrom, modeName, schemaVersion, SongCache } from './cache.js'

const socket = process.env.CACHE_TEST_SOCKET
const minute = 60_000
const t0 = Date.parse('2026-11-14T00:00:00Z')

/** A Session as far as the cache reads one. */
const session = (mode: string, perspectives: { slug: string; title: string; variant?: string }[] = []) =>
  ({ mode, tempo: 80, mood: ['rain', 'gears'], sound: 'oud', choir: 'a woman, with a child', perspectives }) as unknown as Session

const home = { slug: 'progression-chorus-homecoming', title: 'A chorus coming home' }
const lone = { slug: 'choir-lone', title: 'A lone singer' }
/** Six Songs: two dorian coming home, one dorian plain, one aeolian alone and coming home, two aeolian plain. */
const sessions: Record<string, Session> = {
  '1': session('aeolian'),
  '2': session('dorian', [home]),
  '3': session('dorian'),
  '4': session('aeolian', [lone, home]),
  '5': session('dorian', [home]),
  '6': session('aeolian'),
}
const airings = Object.keys(sessions).map((song, i) => ({ song, begins: t0 + i * 8 * minute, seconds: 480 }))
const now = t0 + 5 * 8 * minute + minute

describe('modeName', () => {
  it('names a mode as music does, and one it does not know as written', () => {
    expect(modeName('dorian')).toBe('Dorian')
    expect(modeName('harmonic')).toBe('Harmonic minor')
    expect(modeName('hypodorian')).toBe('Hypodorian')
  })
})

describe('cachedFrom', () => {
  it('keeps the metadata of a Song and its airing, and the ways it was heard', () => {
    expect(cachedFrom(session('dorian', [{ ...home, variant: 'x' }]), airings[0]!)).toEqual({
      song: '1',
      begins: t0,
      seconds: 480,
      mode: 'dorian',
      tempo: 80,
      mood: ['rain', 'gears'],
      sound: 'oud',
      choir: 'a woman, with a child',
      perspectives: [{ ...home, variant: 'x' }],
    })
  })
})

describe('a cache that cannot be reached', () => {
  it('fails at once, so the Radio can answer from the Tactus instead', async () => {
    const away = new SongCache({ path: '/tmp/nowhere-at-all/.s.PGSQL.5432', user: 'radio', database: 'songs' })
    const started = Date.now()
    await expect(away.prepare()).rejects.toThrow()
    expect(Date.now() - started).toBeLessThan(6000)
    await away.close().catch(() => {})
  })
})

describe.skipIf(!socket)('the cache', () => {
  const cache = () => new SongCache({ path: socket!, user: 'postgres', database: 'postgres' })
  let db: SongCache

  beforeEach(async () => {
    db = cache()
    await db.db.unsafe('drop table if exists song_perspectives; drop table if exists songs; drop table if exists cache_meta;')
    await db.prepare()
  })

  it('fills from the Tactus and the Sessions, once each, and tries a missing Session again later', async () => {
    const reads: string[] = []
    const read = async (song: string) => (reads.push(song), song === '3' ? undefined : sessions[song])
    expect(await db.fill([...airings, airings[1]!], read)).toBe(5)
    expect(await db.fill(airings, read)).toBe(0)
    expect(reads.filter((s) => s === '2')).toHaveLength(1)
    expect(reads.filter((s) => s === '3')).toHaveLength(2)
    expect([...(await db.held())].sort()).toEqual(['1', '2', '4', '5', '6'])
  })

  it('pages the Songs received newest first, the one on now marked, nothing before its time', async () => {
    await db.fill(airings, async (song) => sessions[song])
    const page = await db.page({}, 0, 3, now)
    expect(page.total).toBe(6)
    expect(page.songs.map((s) => s.song)).toEqual(['6', '5', '4'])
    expect(page.songs.map((s) => s.on)).toEqual([true, false, false])
    expect(page.songs[0]!.mood).toEqual(['rain', 'gears'])
    expect(page.songs[0]!.begins).toBe(airings[5]!.begins)
    expect((await db.page({}, 0, 10, t0 + 9 * minute)).total).toBe(2)
  })

  it('finds by mode, by a way of hearing, plainly, and by both', async () => {
    await db.fill(airings, async (song) => sessions[song])
    const found = async (search: { mode?: string; heard?: string }) => (await db.page(search, 0, 10, now)).songs.map((s) => s.song)
    expect(await found({ mode: 'dorian' })).toEqual(['5', '3', '2'])
    expect(await found({ heard: home.slug })).toEqual(['5', '4', '2'])
    expect(await found({ heard: 'plainly' })).toEqual(['6', '3', '1'])
    expect(await found({ mode: 'aeolian', heard: home.slug })).toEqual(['4'])
    expect(await found({ mode: 'aeolian', heard: 'nobody' })).toEqual([])
  })

  it('counts each filter given the other, keeping what finds nothing with its 0', async () => {
    await db.fill(airings, async (song) => sessions[song])
    const all = await db.options({}, now)
    expect(all.modes).toEqual([
      { value: 'aeolian', label: 'Aeolian', count: 3 },
      { value: 'dorian', label: 'Dorian', count: 3 },
    ])
    expect(all.heard).toEqual([
      { value: 'plainly', label: 'plainly', count: 3 },
      { value: home.slug, label: 'A chorus coming home', count: 3 },
      { value: lone.slug, label: 'A lone singer', count: 1 },
    ])
    expect(all.any).toEqual({ mode: 6, heard: 6 })
    const dorian = await db.options({ mode: 'dorian' }, now)
    expect(dorian.heard.map((o) => o.count)).toEqual([1, 2, 0])
    expect(dorian.any.heard).toBe(3)
    const lonely = await db.options({ heard: lone.slug }, now)
    expect(lonely.modes.map((o) => o.count)).toEqual([1, 0])
    expect(lonely.any.mode).toBe(1)
  })

  it('names a Perspective by its newest title', async () => {
    await db.fill(airings, async (song) => sessions[song])
    await db.add(cachedFrom(session('dorian', [{ slug: home.slug, title: 'Choruses coming home' }]), { song: '7', begins: now - 1000, seconds: 480 }))
    expect((await db.options({}, now)).heard.find((o) => o.value === home.slug)?.label).toBe('Choruses coming home')
  })

  it('drops and makes its tables again when their shape changes, and keeps them when it has not', async () => {
    await db.fill(airings, async (song) => sessions[song])
    await db.prepare()
    expect((await db.held()).size).toBe(6)
    await db.db`update cache_meta set value = ${'0'} where key = 'schema'`
    await db.prepare()
    expect((await db.held()).size).toBe(0)
    const [{ value }] = await db.db`select value from cache_meta where key = 'schema'`
    expect(value).toBe(schemaVersion)
  })

  it('keeps a Song with a number past any integer', async () => {
    const huge = '123456789012345678901234567890'
    await db.add(cachedFrom(session('lydian'), { song: huge, begins: now - 1000, seconds: 300 }))
    expect((await db.page({ mode: 'lydian' }, 0, 1, now)).songs[0]!.song).toBe(huge)
  })
})
