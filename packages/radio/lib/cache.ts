// The Songs received, kept where they can be searched (plan "Searching the
// Songs received"). The Archive is the truth about what a Song is, and the
// Tactus about when it aired; this is only what the list and its search
// need of them: a Song's weather, its mode and tempo, its band and choir,
// and the ways it was heard. It is a SQLite file on a volume that lives and
// dies with the Radio's pod, filled again from the Archive and the Tactus
// every time the Radio wakes, and the song never waits for it. A change of
// its shape is not migrated: the tables are dropped and filled again.

import { Database } from 'bun:sqlite'
import { slugOf, type Session } from 'archive'
import { arrangementName } from './speaks.js'
import { endOf, type Airing } from './tactus.js'

/** The shape of the tables; when it changes, they are dropped and filled again. */
export const schemaVersion = 3

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
  /** The Arrangement slug (`the-song` for older Songs before Arrangements were recorded). */
  arrangement: string
  /** The Arrangement's human title (`The Song as it always was`, `The Long Breath`, …). */
  arrangementTitle: string
  /** The name the mind gave it, punctuation and all. */
  name?: string
  /** The slug its name makes: the words of the Song's only link. */
  slug?: string
  sound?: string
  choir?: string
  /** What the mind thought of the Song, if kept. */
  thought?: string
  /** Non-default Tracks active in the Song (`drone`, `pulse`, …), if any. */
  tracks?: string[]
  /** Distinct part types and tempo cues (`free time`, extra tempi), for metadata search. */
  meta?: string
  perspectives: { slug: string; title: string; variant?: string }[]
}

/** What the search asks for: free-text metadata query `q`, a mode, and how it was heard (`plainly` or a Perspective's slug). */
export type Search = { q?: string; mode?: string; heard?: string }

/**
 * Column relevance weights for SQLite FTS5 `bm25(songs_fts, ...)` across Song metadata
 * (ordered to match `songs_fts` columns: song, name, mood, sound, arrangement, mode,
 * perspectives, choir, meta, thought). Lyrics are deliberately excluded.
 */
export const ftsWeights = [20, 12, 8, 7, 6, 5, 4.5, 3.5, 3, 2] as const

/**
 * Turns a listener's free-text query into a safe SQLite FTS5 `MATCH` expression.
 * Supports quoted phrases (`"long breath"`), prefix matching on plain words (`kraut` → `"kraut"*`),
 * formatted Song numbers (`2,014` → `"2014"*`), and multi-word AND semantics.
 * Never throws on punctuation or malformed quotes; returns undefined if nothing searchable remains.
 */
export function ftsQueryOf(raw?: string): { match: string; exactSong?: string } | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim().slice(0, 160)
  if (!trimmed) return undefined
  const terms: string[] = []
  const tokenPattern = /"([^"]*)"|(\S+)/g
  for (const hit of trimmed.matchAll(tokenPattern)) {
    if (terms.length >= 12) break
    const quoted = hit[1]
    if (quoted !== undefined) {
      const cleaned = quoted
        .replace(/[^\p{L}\p{N}\s'-]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (cleaned) terms.push(`"${cleaned}"`)
      continue
    }
    const bare = hit[2]!
    // formatted Song numbers like "2,014" → "2014"
    if (/^\d[\d,]*$/.test(bare)) {
      const digits = bare.replace(/,/g, '')
      if (digits) terms.push(`"${digits}"*`)
      continue
    }
    const parts = bare
      .split(/[^\p{L}\p{N}'-]+/u)
      .map((part) => part.replace(/^['-]+|['-]+$/g, ''))
      .filter(Boolean)
    for (const part of parts) {
      if (terms.length >= 12) break
      terms.push(part.length >= 2 ? `"${part}"*` : `"${part}"`)
    }
  }
  if (terms.length === 0) return undefined
  const digitsOnly = trimmed.replace(/,/g, '')
  const exactSong = /^\d{1,400}$/.test(digitsOnly) ? digitsOnly : undefined
  return { match: terms.join(' '), ...(exactSong ? { exactSong } : {}) }
}

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

/** Summarizes a Session's tempo variations, active tracks, and part kinds into searchable metadata words. */
function metaOf(session: Session): string {
  const tokens = new Set<string>()
  const baseTempo = Math.round(session.tempo)
  if (Number.isFinite(baseTempo) && baseTempo > 0) tokens.add(`${baseTempo} bpm`)
  for (const track of session.tracks ?? []) tokens.add(track)
  for (const it of session.iterations ?? []) {
    for (const part of it.parts ?? []) {
      tokens.add(part.type)
      if (part.tempo === null) tokens.add('free time')
      else if (typeof part.tempo === 'number' && Number.isFinite(part.tempo)) tokens.add(`${Math.round(part.tempo)} bpm`)
      if (part.mode) {
        tokens.add(part.mode)
        tokens.add(modeName(part.mode))
      }
    }
  }
  return [...tokens].join(' ')
}

/** A Song as the cache keeps it, from its Session and its airing. */
export function cachedFrom(session: Session, airing: Airing): CachedSong {
  const arrangement = session.arrangement ?? 'the-song'
  const arrangementTitle = arrangementName(session.arrangement, session.arrangementTitle)
  const meta = metaOf(session)
  return {
    song: airing.song,
    begins: airing.begins,
    seconds: airing.seconds,
    mode: session.mode,
    tempo: Math.round(session.tempo),
    mood: session.mood ?? [],
    arrangement,
    arrangementTitle,
    ...(session.name ? { name: session.name, slug: slugOf(session.name) } : {}),
    ...(session.sound ? { sound: session.sound } : {}),
    ...(session.choir ? { choir: session.choir } : {}),
    ...(session.thought ? { thought: session.thought } : {}),
    ...(session.tracks?.length ? { tracks: session.tracks } : {}),
    ...(meta ? { meta } : {}),
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
        drop table if exists songs_fts;
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
          arrangement text not null,
          arrangement_title text not null,
          name text,
          slug text,
          sound text,
          choir text,
          thought text,
          tracks text,
          meta text
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
        create virtual table songs_fts using fts5(
          song,
          name,
          mood,
          sound,
          arrangement,
          mode,
          perspectives,
          choir,
          meta,
          thought,
          tokenize='porter unicode61 remove_diacritics 2'
        );
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
      const existing = this.db.query('select rowid from songs where song = ?').get(song.song) as { rowid: number } | null
      if (existing) {
        this.db.query('delete from songs_fts where rowid = ?').run(existing.rowid)
        this.db.query('delete from songs where song = ?').run(song.song)
      }
      const inserted = this.db
        .query(
          `insert into songs (song, sortable, begins, seconds, mode, tempo, mood, arrangement, arrangement_title, name, slug, sound, choir, thought, tracks, meta)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          song.song,
          sortable(song.song),
          song.begins,
          song.seconds,
          song.mode,
          song.tempo,
          JSON.stringify(song.mood),
          song.arrangement,
          song.arrangementTitle,
          song.name ?? null,
          song.slug ?? null,
          song.sound ?? null,
          song.choir ?? null,
          song.thought ?? null,
          song.tracks?.length ? JSON.stringify(song.tracks) : null,
          song.meta ?? null,
        )
      for (const p of song.perspectives) {
        this.db
          .query('insert or ignore into song_perspectives (song, slug, title, variant) values (?, ?, ?, ?)')
          .run(song.song, p.slug, p.title, p.variant ?? null)
      }
      const perspectiveText = song.perspectives.length
        ? song.perspectives.map(({ title, variant, slug }) => [title, variant, slug].filter(Boolean).join(' ')).join(' ')
        : 'plainly'
      const modeText = song.mode ? `${song.mode} ${modeName(song.mode)}` : ''
      const arrangementText = `${song.arrangementTitle} ${song.arrangement}`
      this.db
        .query(
          `insert into songs_fts (rowid, song, name, mood, sound, arrangement, mode, perspectives, choir, meta, thought)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          inserted.lastInsertRowid,
          song.song,
          song.name ?? '',
          song.mood.join(' '),
          song.sound ?? '',
          arrangementText,
          modeText,
          perspectiveText,
          song.choir ?? '',
          song.meta ?? `${song.tempo} bpm`,
          song.thought ?? '',
        )
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

  /**
   * The Songs it holds without a name, and the Archive has named since it
   * kept them: a Song is read as it is now, and kept again. `worn` is the
   * set of Song numbers the Archive has named. Returns how many it named.
   */
  async renamed(
    worn: ReadonlySet<string>,
    session: (song: string) => Promise<Session | undefined>,
    few = 4,
  ): Promise<number> {
    const unnamed = (
      this.db.query('select song, begins, seconds from songs where name is null').all() as {
        song: string
        begins: number
        seconds: number
      }[]
    ).filter(({ song }) => worn.has(song))
    let named = 0
    for (let i = 0; i < unnamed.length; i += few) {
      await Promise.all(
        unnamed.slice(i, i + few).map(async (held) => {
          const found = await session(held.song).catch(() => undefined)
          if (!found?.name) return
          await this.add(cachedFrom(found, { song: held.song, begins: held.begins, seconds: held.seconds }))
          named++
        }),
      )
    }
    return named
  }

  /** The search, as a FROM+WHERE clause on `songs s` and its values: received by `now`, matching `q` (if any), in the mode, heard that way. */
  private filter({ q, mode, heard }: Search, now: number): { from: string; where: string; values: (string | number)[]; fts?: { match: string; exactSong?: string } } {
    const fts = ftsQueryOf(q)
    const from = fts ? 'songs s join songs_fts on songs_fts.rowid = s.rowid' : 'songs s'
    const parts = ['s.begins <= ?']
    const values: (string | number)[] = [now]
    if (fts) parts.push('songs_fts match ?'), values.push(fts.match)
    if (mode) parts.push('s.mode = ?'), values.push(mode)
    if (heard === 'plainly') parts.push('not exists (select 1 from song_perspectives p where p.song = s.song)')
    else if (heard) parts.push('exists (select 1 from song_perspectives p where p.song = s.song and p.slug = ?)'), values.push(heard)
    return { from, where: parts.join(' and '), values, ...(fts ? { fts } : {}) }
  }

  private count(search: Search, now: number) {
    const { from, where, values } = this.filter(search, now)
    return (this.db.query(`select count(*) as n from ${from} where ${where}`).get(...values) as { n: number }).n
  }

  /**
   * A page of the Songs received that the search finds, and how many it finds in all.
   * When a free-text query `q` is active, Songs are ranked by weighted BM25 relevance across
   * Song metadata (exact Song number first, then title, weather, band, arrangement, mode,
   * perspectives, choir, tempo/tracks/parts, thought), breaking ties newest-first.
   * Without `q`, Songs are ordered chronologically newest-first.
   */
  async page(
    search: Search,
    offset: number,
    count: number,
    now = Date.now(),
  ): Promise<{ total: number; offset: number; songs: { song: string; begins: number; seconds: number; on: boolean; mood: string[]; name?: string; slug?: string }[] }> {
    const { from, where, values, fts } = this.filter(search, now)
    const weightArgs = ftsWeights.join(', ')
    const order = fts
      ? fts.exactSong
        ? `case when s.song = ? then 0 else 1 end asc, bm25(songs_fts, ${weightArgs}) asc, s.begins desc, s.sortable desc`
        : `bm25(songs_fts, ${weightArgs}) asc, s.begins desc, s.sortable desc`
      : 's.begins desc, s.sortable desc'
    const orderValues = fts?.exactSong ? [fts.exactSong] : []
    const rows = this.db
      .query(`select s.song, s.begins, s.seconds, s.mood, s.name, s.slug from ${from} where ${where} order by ${order} limit ? offset ?`)
      .all(...values, ...orderValues, count, offset) as { song: string; begins: number; seconds: number; mood: string; name: string | null; slug: string | null }[]
    return {
      total: this.count(search, now),
      offset,
      songs: rows.map((row) => {
        const airing = { song: row.song, begins: row.begins, seconds: row.seconds }
        return {
          ...airing,
          on: endOf(airing) > now,
          mood: JSON.parse(row.mood) as string[],
          ...(row.slug ? { name: row.name ?? undefined, slug: row.slug } : {}),
        }
      }),
    }
  }

  /**
   * Both filters' options, each counted given the other and any free-text query `q`: the modes
   * the Songs received were sung in, and the ways they were heard, plainly first and then each
   * Perspective by its newest title. An option that finds nothing is still listed with its 0.
   */
  async options({ q, mode, heard }: Search, now = Date.now()): Promise<{ modes: Option[]; heard: Option[]; any: { mode: number; heard: number } }> {
    const byHeard = this.filter({ q, heard }, now)
    const byMode = this.filter({ q, mode }, now)
    const modeCounts = new Map(
      (this.db.query(`select s.mode as mode, count(*) as n from ${byHeard.from} where ${byHeard.where} group by s.mode`).all(...byHeard.values) as { mode: string; n: number }[]).map(
        ({ mode: m, n }) => [m, n],
      ),
    )
    const modes = (this.db.query('select distinct mode from songs where begins <= ?').all(now) as { mode: string }[])
      .map(({ mode: m }) => ({ value: m, label: modeName(m), count: modeCounts.get(m) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label))
    const heardCounts = new Map(
      (
        this.db
          .query(`select p.slug as slug, count(distinct s.song) as n from ${byMode.from} join song_perspectives p on p.song = s.song where ${byMode.where} group by p.slug`)
          .all(...byMode.values) as { slug: string; n: number }[]
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
      heard: [{ value: 'plainly', label: 'plainly', count: this.count({ q, mode, heard: 'plainly' }, now) }, ...ways],
      any: { mode: this.count({ q, heard }, now), heard: this.count({ q, mode }, now) },
    }
  }

  async close() {
    this.db.close()
  }
}
