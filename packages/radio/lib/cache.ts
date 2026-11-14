// The Songs received, kept where they can be searched (plan "Searching the
// Songs received"). The Archive is the truth about what a Song is, and the
// Tactus about when it aired; this is only what the list and its search
// need of them, kept in a small Postgres beside the Radio: a Song's weather,
// its mode and tempo, its band and choir, and the ways it was heard. It can
// be dropped at any moment and filled again from the Archive and the Tactus,
// and the song never waits for it. A change of its shape is not migrated:
// the tables are dropped and filled again.

import { SQL } from 'bun'
import type { Session } from 'archive'
import { endOf, type Airing } from './tactus.js'

/** The shape of the tables; when it changes, they are dropped and filled again. */
export const schemaVersion = '1'

/** A Song as the list shows it and the search finds it. */
export type CachedSong = {
  song: string
  /** When it first aired, in milliseconds since the epoch. */
  begins: number
  /** How long it lasted, as aired. */
  seconds: number
  mode: string
  tempo: number
  mood: string[]
  sound?: string
  choir?: string
  perspectives: { slug: string; title: string; variant?: string }[]
}

/** What the search asks for: a mode, and how it was heard, `plainly` for from no Perspective, or a Perspective's slug. */
export type Search = { mode?: string; heard?: string }

/** One option of a filter, counted given the other filter. */
export type Option = { value: string; label: string; count: number }

/** How music names each mode. */
const modeNames: Record<string, string> = {
  ionian: 'Ionian',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  aeolian: 'Aeolian',
  locrian: 'Locrian',
  harmonic: 'Harmonic minor',
}

/** A mode's name as music says it; one the song learns later is named as it is written, capitalized. */
export const modeName = (mode: string) => modeNames[mode] ?? mode.charAt(0).toUpperCase() + mode.slice(1)

/** A Song as the cache keeps it, from its Session and its airing. */
export function cachedFrom(session: Session, airing: Airing): CachedSong {
  return {
    song: airing.song,
    begins: airing.begins,
    seconds: airing.seconds,
    mode: session.mode,
    tempo: Math.round(session.tempo),
    mood: session.mood ?? [],
    ...(session.sound ? { sound: session.sound } : {}),
    ...(session.choir ? { choir: session.choir } : {}),
    perspectives: (session.perspectives ?? []).map(({ slug, title, variant }) => ({ slug, title, ...(variant ? { variant } : {}) })),
  }
}

/** Where the cache is: a host and its credentials, or a unix socket. */
export type Where = { host?: string; port?: number; path?: string; user: string; password?: string; database: string; tls?: boolean }

export class SongCache {
  readonly db: SQL

  constructor(where: Where) {
    // a host that is a folder is where the Postgres keeps its socket, as Postgres itself reads it
    const path = where.path ?? (where.host?.startsWith('/') ? `${where.host}/.s.PGSQL.${where.port ?? 5432}` : undefined)
    this.db = new SQL({
      ...(path ? { path } : { hostname: where.host, port: where.port ?? 5432 }),
      username: where.user,
      ...(where.password ? { password: where.password } : {}),
      database: where.database,
      // the operator's Postgres speaks TLS with a certificate of its own making
      ...(where.tls ? { tls: { rejectUnauthorized: false } } : {}),
      max: 4,
      connectionTimeout: 5,
      idleTimeout: 60,
    })
  }

  /** Makes the tables, or, when their shape has changed, drops and makes them again. */
  async prepare() {
    await this.db`create table if not exists cache_meta (key text primary key, value text not null)`
    const [kept] = await this.db`select value from cache_meta where key = 'schema'`
    if (kept?.value === schemaVersion) return
    await this.db.begin(async (tx) => {
      await tx.unsafe(`
        drop table if exists song_perspectives;
        drop table if exists songs;
        create table songs (
          song numeric primary key,
          begins timestamptz not null,
          seconds real not null,
          mode text not null,
          tempo int not null,
          mood text[] not null,
          sound text,
          choir text
        );
        create index songs_mode on songs (mode);
        create index songs_begins on songs (begins desc);
        create table song_perspectives (
          song numeric not null references songs (song) on delete cascade,
          slug text not null,
          title text not null,
          variant text,
          primary key (song, slug)
        );
        create index song_perspectives_slug on song_perspectives (slug);
      `)
      await tx`insert into cache_meta (key, value) values ('schema', ${schemaVersion})
        on conflict (key) do update set value = excluded.value`
    })
  }

  /** The Songs it holds. */
  async held(): Promise<Set<string>> {
    const rows = await this.db`select song::text as song from songs`
    return new Set(rows.map((row: { song: string }) => row.song))
  }

  /** Keeps a Song, or keeps it again as it is now. */
  async add(song: CachedSong) {
    await this.db.begin(async (tx) => {
      await tx`delete from songs where song = ${song.song}::numeric`
      await tx`insert into songs (song, begins, seconds, mode, tempo, mood, sound, choir) values (
        ${song.song}::numeric, ${new Date(song.begins)}, ${song.seconds}, ${song.mode}, ${song.tempo},
        ${song.mood}::text[], ${song.sound ?? null}, ${song.choir ?? null})`
      for (const p of song.perspectives) {
        await tx`insert into song_perspectives (song, slug, title, variant)
          values (${song.song}::numeric, ${p.slug}, ${p.title}, ${p.variant ?? null})
          on conflict do nothing`
      }
    })
  }

  /**
   * Fills in every Song the Tactus has announced that the cache does not
   * hold, reading each one's Session, `few` at a time. A Song whose Session
   * cannot be read now is tried again next time. Returns how many it added.
   */
  async fill(airings: readonly Airing[], session: (song: string) => Promise<Session | undefined>, few = 4): Promise<number> {
    const held = await this.held()
    const first = new Map<string, Airing>()
    for (const airing of airings) if (!held.has(airing.song) && !first.has(airing.song)) first.set(airing.song, airing)
    const missing = [...first.values()].reverse()
    let added = 0
    for (let i = 0; i < missing.length; i += few) {
      await Promise.all(
        missing.slice(i, i + few).map(async (airing) => {
          const found = await session(airing.song).catch(() => undefined)
          if (!found) return
          await this.add(cachedFrom(found, airing))
          added++
        }),
      )
    }
    return added
  }

  /** The search, as a condition on `songs s`: received by `now`, in the mode, heard that way. */
  private where({ mode, heard }: Search, now: number) {
    const db = this.db
    return db`s.begins <= ${new Date(now)}
      ${mode ? db`and s.mode = ${mode}` : db``}
      ${heard === 'plainly' ? db`and not exists (select 1 from song_perspectives p where p.song = s.song)` : db``}
      ${heard && heard !== 'plainly' ? db`and exists (select 1 from song_perspectives p where p.song = s.song and p.slug = ${heard})` : db``}`
  }

  /** A page of the Songs received, newest first, that the search finds, and how many it finds in all. */
  async page(
    search: Search,
    offset: number,
    count: number,
    now = Date.now(),
  ): Promise<{ total: number; offset: number; songs: { song: string; begins: number; seconds: number; on: boolean; mood: string[] }[] }> {
    const where = this.where(search, now)
    const [{ total }] = await this.db`select count(*)::int as total from songs s where ${where}`
    const rows = await this.db`select s.song::text as song, s.begins, s.seconds, s.mood from songs s
      where ${where} order by s.begins desc, s.song desc offset ${offset} limit ${count}`
    return {
      total: total as number,
      offset,
      songs: rows.map((row: { song: string; begins: Date; seconds: number; mood: string[] }) => {
        const airing = { song: row.song, begins: new Date(row.begins).getTime(), seconds: row.seconds }
        return { ...airing, on: endOf(airing) > now, mood: row.mood }
      }),
    }
  }

  /**
   * Both filters' options, each counted given the other: the modes the Songs
   * received were sung in, and the ways they were heard, plainly first and
   * then each Perspective by its newest title. An option that finds nothing
   * given the other filter is still listed, with its 0. `any` is how many
   * each filter finds left at "any".
   */
  async options({ mode, heard }: Search, now = Date.now()): Promise<{ modes: Option[]; heard: Option[]; any: { mode: number; heard: number } }> {
    const db = this.db
    const received = db`s.begins <= ${new Date(now)}`
    const allModes = await db`select distinct s.mode from songs s where ${received}`
    const modeCounts = await db`select s.mode, count(*)::int as count from songs s where ${this.where({ heard }, now)} group by s.mode`
    const titles = await db`select distinct on (p.slug) p.slug, p.title from song_perspectives p join songs s on s.song = p.song
      where ${received} order by p.slug, s.begins desc`
    const heardCounts = await db`select p.slug, count(distinct s.song)::int as count from songs s join song_perspectives p on p.song = s.song
      where ${this.where({ mode }, now)} group by p.slug`
    const [{ plain }] = await db`select count(*)::int as plain from songs s where ${this.where({ mode, heard: 'plainly' }, now)}`
    const [{ anyMode }] = await db`select count(*)::int as "anyMode" from songs s where ${this.where({ heard }, now)}`
    const [{ anyHeard }] = await db`select count(*)::int as "anyHeard" from songs s where ${this.where({ mode }, now)}`
    const countOf = (rows: { count: number }[], key: string, value: string) =>
      (rows.find((row) => (row as unknown as Record<string, string>)[key] === value)?.count ?? 0) as number
    const modes = allModes
      .map(({ mode: m }: { mode: string }) => ({ value: m, label: modeName(m), count: countOf(modeCounts, 'mode', m) }))
      .sort((a: Option, b: Option) => a.label.localeCompare(b.label))
    const ways = titles
      .map(({ slug, title }: { slug: string; title: string }) => ({ value: slug, label: title, count: countOf(heardCounts, 'slug', slug) }))
      .sort((a: Option, b: Option) => a.label.localeCompare(b.label))
    return { modes, heard: [{ value: 'plainly', label: 'plainly', count: plain }, ...ways], any: { mode: anyMode, heard: anyHeard } }
  }

  async close() {
    await this.db.close()
  }
}
