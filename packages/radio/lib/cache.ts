// The Songs received, kept where they can be searched (plan "Searching the
// Songs received"). The Archive is the truth about what a Song is, and the
// Tactus about when it aired; this is only what the list and its search
// need of them: a Song's weather, its mode and tempo, its band and choir,
// and the ways it was heard. It is a SQLite file on a volume that lives and
// dies with the Radio's pod, filled again from the Archive and the Tactus
// every time the Radio wakes, and the song never waits for it. A change of
// its shape is not migrated: the tables are dropped and filled again.

import { Database } from 'bun:sqlite'
import type { Session } from 'archive'
import { endOf, type Airing } from './tactus.js'

/** The shape of the tables; when it changes, they are dropped and filled again. */
export const schemaVersion = 1

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

/** A Song number, padded so that numbers of any length sort as numbers do: by length, then by digits. */
const sortable = (song: string) => `${String(song.length).padStart(4, '0')}:${song}`

export class SongCache {
  readonly db: Database

  /** `file` is where the cache is kept; `:memory:` keeps it in memory only. */
  constructor(file = ':memory:') {
    this.db = new Database(file, { create: true, strict: true })
    this.db.exec('pragma journal_mode = wal; pragma foreign_keys = on;')
  }

  /** Makes the tables, or, when their shape has changed, drops and makes them again. */
  async prepare() {
    const { user_version: kept } = this.db.query('pragma user_version').get() as { user_version: number }
    if (kept === schemaVersion) return
    this.db.transaction(() => {
      this.db.exec(`
        drop table if exists song_perspectives;
        drop table if exists songs;
        create table songs (
          song text primary key,
          sortable text not null,
          begins integer not null,
          seconds real not null,
          mode text not null,
          tempo integer not null,
          mood text not null,
          sound text,
          choir text
        );
        create index songs_mode on songs (mode);
        create index songs_begins on songs (begins desc);
        create table song_perspectives (
          song text not null references songs (song) on delete cascade,
          slug text not null,
          title text not null,
          variant text,
          primary key (song, slug)
        );
        create index song_perspectives_slug on song_perspectives (slug);
        pragma user_version = ${schemaVersion};
      `)
    })()
  }

  /** The Songs it holds. */
  async held(): Promise<Set<string>> {
    return new Set((this.db.query('select song from songs').all() as { song: string }[]).map(({ song }) => song))
  }

  /** Keeps a Song, or keeps it again as it is now. */
  async add(song: CachedSong) {
    this.db.transaction(() => {
      this.db.query('delete from songs where song = ?').run(song.song)
      this.db
        .query('insert into songs (song, sortable, begins, seconds, mode, tempo, mood, sound, choir) values (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(song.song, sortable(song.song), song.begins, song.seconds, song.mode, song.tempo, JSON.stringify(song.mood), song.sound ?? null, song.choir ?? null)
      for (const p of song.perspectives) {
        this.db
          .query('insert or ignore into song_perspectives (song, slug, title, variant) values (?, ?, ?, ?)')
          .run(song.song, p.slug, p.title, p.variant ?? null)
      }
    })()
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

  /** The search, as a condition on `songs s` and its values: received by `now`, in the mode, heard that way. */
  private where({ mode, heard }: Search, now: number): [string, (string | number)[]] {
    const parts = ['s.begins <= ?']
    const values: (string | number)[] = [now]
    if (mode) parts.push('s.mode = ?'), values.push(mode)
    if (heard === 'plainly') parts.push('not exists (select 1 from song_perspectives p where p.song = s.song)')
    else if (heard) parts.push('exists (select 1 from song_perspectives p where p.song = s.song and p.slug = ?)'), values.push(heard)
    return [parts.join(' and '), values]
  }

  private count(search: Search, now: number) {
    const [where, values] = this.where(search, now)
    return (this.db.query(`select count(*) as n from songs s where ${where}`).get(...values) as { n: number }).n
  }

  /** A page of the Songs received, newest first, that the search finds, and how many it finds in all. */
  async page(
    search: Search,
    offset: number,
    count: number,
    now = Date.now(),
  ): Promise<{ total: number; offset: number; songs: { song: string; begins: number; seconds: number; on: boolean; mood: string[] }[] }> {
    const [where, values] = this.where(search, now)
    const rows = this.db
      .query(`select song, begins, seconds, mood from songs s where ${where} order by s.begins desc, s.sortable desc limit ? offset ?`)
      .all(...values, count, offset) as { song: string; begins: number; seconds: number; mood: string }[]
    return {
      total: this.count(search, now),
      offset,
      songs: rows.map((row) => {
        const airing = { song: row.song, begins: row.begins, seconds: row.seconds }
        return { ...airing, on: endOf(airing) > now, mood: JSON.parse(row.mood) as string[] }
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
    const [byHeard, heardValues] = this.where({ heard }, now)
    const [byMode, modeValues] = this.where({ mode }, now)
    const modeCounts = new Map(
      (this.db.query(`select s.mode as mode, count(*) as n from songs s where ${byHeard} group by s.mode`).all(...heardValues) as { mode: string; n: number }[]).map(
        ({ mode: m, n }) => [m, n],
      ),
    )
    const modes = (this.db.query('select distinct mode from songs where begins <= ?').all(now) as { mode: string }[])
      .map(({ mode: m }) => ({ value: m, label: modeName(m), count: modeCounts.get(m) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label))
    const heardCounts = new Map(
      (
        this.db
          .query(`select p.slug as slug, count(distinct s.song) as n from songs s join song_perspectives p on p.song = s.song where ${byMode} group by p.slug`)
          .all(...modeValues) as { slug: string; n: number }[]
      ).map(({ slug, n }) => [slug, n]),
    )
    // each Perspective by the title it had when it was last heard
    const titles = this.db
      .query(
        `select p.slug as slug, p.title as title from song_perspectives p join songs s on s.song = p.song
         where s.begins <= ? and s.begins = (select max(t.begins) from songs t join song_perspectives q on q.song = t.song where q.slug = p.slug and t.begins <= ?)`,
      )
      .all(now, now) as { slug: string; title: string }[]
    const ways = [...new Map(titles.map(({ slug, title }) => [slug, title]))]
      .map(([slug, title]) => ({ value: slug, label: title, count: heardCounts.get(slug) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return {
      modes,
      heard: [{ value: 'plainly', label: 'plainly', count: this.count({ mode, heard: 'plainly' }, now) }, ...ways],
      any: { mode: this.count({ heard }, now), heard: this.count({ mode }, now) },
    }
  }

  async close() {
    this.db.close()
  }
}
