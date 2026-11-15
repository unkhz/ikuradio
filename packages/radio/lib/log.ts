// The Radio's log (plan "The Radio keeps a log"). Nobody knew whether
// anyone listened. Now every request the Radio answers is written down in
// SQLite on its volume, where it outlives the pod: when, what was asked,
// how it was answered and how fast, and what the request says of where in
// the world it came from, no finer than its city, and what asked. No address is kept, in any form:
// nothing in it can tell one visitor from another. The receivers'
// heartbeat, /tactus every few seconds, is counted per minute by country
// and city instead of written down each time. The log is never served.
// Writing it never slows or breaks an answer: rows wait in memory and are
// written a second later, and a write that fails is let go.

import { Database } from 'bun:sqlite'

/** The shape of the tables. A log of another shape is begun again when it is opened. */
const schemaVersion = 2
const schema = `
  drop table if exists requests;
  drop table if exists tactus;
  create table requests (
    id integer primary key,
    at integer not null,
    method text not null,
    path text not null,
    query text,
    status integer not null,
    ms real not null,
    country text,
    city text,
    continent text,
    region text,
    region_code text,
    timezone text,
    ray text,
    cf_visitor text,
    forwarded_proto text,
    host text,
    user_agent text,
    referer text,
    accept_language text,
    client_hints text
  );
  create index requests_at on requests (at);
  create index requests_path on requests (path);
  create table tactus (
    minute integer not null,
    country text not null,
    city text not null,
    count integer not null,
    primary key (minute, country, city)
  );
  pragma user_version = ${schemaVersion};
`

/** The location headers Cloudflare adds, each to its column. */
const located = {
  country: 'cf-ipcountry',
  city: 'cf-ipcity',
  continent: 'cf-ipcontinent',
  region: 'cf-region',
  region_code: 'cf-region-code',
  timezone: 'cf-timezone',
} as const

/** The rest of what a request says of itself, each to its column. */
const told = {
  ray: 'cf-ray',
  cf_visitor: 'cf-visitor',
  forwarded_proto: 'x-forwarded-proto',
  host: 'host',
  user_agent: 'user-agent',
  referer: 'referer',
  accept_language: 'accept-language',
} as const

/** A header's value, as it is kept: no longer than anyone needs. */
const kept = (value: string | null) => (value === null ? null : value.slice(0, 1000))

/** A request answered, as the log is given it. */
export type Answered = { at: number; method: string; url: URL; status: number; ms: number; headers: Headers }

export class RequestLog {
  readonly db: Database
  private waiting: Answered[] = []
  private timer: ReturnType<typeof setInterval> | undefined

  /** Opens the log at `file`, or makes it; one of an earlier shape is begun again. */
  constructor(file: string, { flushEvery = 1000 }: { flushEvery?: number } = {}) {
    this.db = new Database(file, { create: true, strict: true })
    this.db.exec('pragma journal_mode = wal; pragma busy_timeout = 1000;')
    const { user_version: shape } = this.db.query('pragma user_version').get() as { user_version: number }
    if (shape !== schemaVersion) {
      this.db.transaction(() => this.db.exec(schema))()
      // what was dropped is not left lying in the file's free pages
      this.db.exec('vacuum')
    }
    if (flushEvery > 0) {
      this.timer = setInterval(() => this.flush(), flushEvery)
      this.timer.unref?.()
    }
  }

  /** Notes a request, to be written a moment later. Never throws. */
  record(answered: Answered) {
    try {
      this.waiting.push(answered)
      // a log that cannot be written is not allowed to grow without end
      if (this.waiting.length > 10_000) this.waiting.splice(0, this.waiting.length - 10_000)
    } catch {
      // the answer matters more than the log
    }
  }

  /** Writes what is waiting, in one transaction. A write that fails is let go, not thrown. */
  flush() {
    const rows = this.waiting.splice(0)
    if (!rows.length) return
    try {
      const insert = this.db.query(
        `insert into requests (at, method, path, query, status, ms,
          ${Object.keys(located).join(', ')}, ${Object.keys(told).join(', ')}, client_hints)
         values (${Array.from({ length: 6 + Object.keys(located).length + Object.keys(told).length + 1 }, () => '?').join(', ')})`,
      )
      const beat = this.db.query(
        `insert into tactus (minute, country, city, count) values (?, ?, ?, 1)
         on conflict (minute, country, city) do update set count = count + 1`,
      )
      this.db.transaction(() => {
        for (const { at, method, url, status, ms, headers } of rows) {
          if (url.pathname === '/tactus') {
            beat.run(Math.floor(at / 60_000) * 60_000, kept(headers.get('cf-ipcountry')) ?? '', kept(headers.get('cf-ipcity')) ?? '')
            continue
          }
          const hints: Record<string, string> = {}
          headers.forEach((value, name) => {
            if (name.startsWith('sec-ch-ua')) hints[name] = value.slice(0, 500)
          })
          insert.run(
            at,
            method,
            url.pathname.slice(0, 1000),
            url.search ? url.search.slice(1, 1001) : null,
            status,
            Math.round(ms * 10) / 10,
            ...Object.values(located).map((name) => kept(headers.get(name))),
            ...Object.values(told).map((name) => kept(headers.get(name))),
            Object.keys(hints).length ? JSON.stringify(hints) : null,
          )
        }
      })()
    } catch (error) {
      console.warn(`the log could not be written, and ${rows.length} requests went unwritten: ${(error as Error).message}`)
    }
  }

  close() {
    if (this.timer) clearInterval(this.timer)
    this.flush()
    this.db.close()
  }
}
