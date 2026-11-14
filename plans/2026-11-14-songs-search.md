---
date: 2026-11-14
state: active
owner: scientist
id: 10
kind: plan
slug: songs-search
---
# Searching the Songs received

The Songs window lists every Song received, newest first, and nothing more. With Perspectives and homecomings, the interesting question has become "which Songs were heard *this* way?". So the window gets a search.

## Why not three dropdowns

Three independent dropdowns (mode, Perspective, Facet) would fight each other: every Perspective belongs to one Facet, so the two could say contradictory things, and most combinations would find nothing. They don't fit on a phone either. And a Facet is the Studio's own machinery: it belongs behind the fourth wall, not in front of a listener.

## The design: two filters, each knowing the other

**1. Mode:** which mode the Song was sung in, named exactly as music names it: Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian. Music is timeless, so the exact terms stay.

**2. Heard:** how the Song was heard. A plain list of the Perspectives by their titles, a little mysterious as they are, with "plainly" first:

```
Heard:  any way
        plainly
        A chorus coming home
        A full choir
        A lone singer
        Atonal bridges
        Bridges hummed often
        ...
```

"plainly" finds the Songs heard from no Perspective at all, which is most of them. The Perspectives are listed by title, alphabetically. Neither Facets nor slugs are ever shown.

**They narrow each other, and never lead nowhere.** Each filter's options are counted *given the other filter*. With Mode set to Dorian, the Heard list shows how many Dorian Songs each way finds, and a way that finds none is shown disabled with its 0, not hidden, so the list doesn't jump around. The same goes the other way. A listener can only make a choice that finds something.

**Every option comes from the data.** Modes and Perspectives come and go, so the options are read from the Songs received, never from a fixed list.

**What is chosen stays visible.** Above the list, one line says what is shown, for example "Dorian · A chorus coming home: 4 Songs". Each part can be cleared with its own ×, and "clear" clears both.

**On a phone:** the two filters are native `<select>` elements, each full width and stacked, at least 44 px tall, which a phone opens as its own picker. The summary line stays above the list, and the list scrolls beneath it. On a wide screen the two sit side by side.

## The cache: an ephemeral Postgres beside the Radio

The Archive is the truth about what a Song is, and the Tactus about when it aired. Searching them directly would mean reading every Session for every question, so the Radio keeps a **cache** of what the list and the search need. It is a database that can be dropped at any moment and rebuilt from the Archive and the Tactus.

- **Where:** a small Postgres in khz-k3s, made by the Zalando postgres-operator: a `postgresql` resource (`acid.zalan.do/v1`) in `.khz-k3s/`, one instance, 1 Gi of storage, no backups. It is a cache, so losing it costs only a rebuild.
- **Credentials:** the operator generates a Secret for the Radio's database user. The Radio's Deployment reads the host, user and password from it as env vars.
- **The client:** Bun's built-in Postgres client (`import { sql } from 'bun'`), so no new dependency.

### What it holds: the metadata, not the meat

```sql
-- one row per Song received: what the list shows and the search filters on
create table songs (
  song      numeric primary key,   -- a Song number can outgrow bigint, in time
  begins    timestamptz not null,  -- when it first aired, from the Tactus
  seconds   real not null,         -- as aired
  mode      text not null,
  tempo     int not null,
  mood      text[] not null,
  sound     text,
  choir     text
);
create index songs_mode on songs (mode);
create index songs_begins on songs (begins desc);

-- one row per Perspective a Song was heard from
create table song_perspectives (
  song        numeric not null references songs (song) on delete cascade,
  slug        text not null,
  title       text not null,
  variant     text,
  primary key (song, slug)
);
create index song_perspectives_slug on song_perspectives (slug);
```

Iterations, recordings, guides and takes are left out. Receivers still read those from the Session, in the Archive, when they play a Song.

### How it is kept

- **On start:** the Radio creates the tables if missing, then fills in every Song in the Tactus history that the cache doesn't have. It reads each one's Session from the Archive, a few at a time.
- **While running:** when an airing begins, its Song is added the same way.
- **The cache can fall behind or vanish.** If the database can't be reached, `/songs/page` answers from the Tactus as it does today, without search, and the filters are hidden. When the database returns, the Radio fills in what's missing. The song never waits for its cache.
- **A schema version** is kept in the database. When the Radio's schema changes, it drops the tables and rebuilds them, rather than migrating a cache.

## The Radio's API

The filters travel as two parameters:

- `mode=<mode>`
- `heard=plainly` or `heard=<slug>` (the slug travels in the address, but only titles are shown)

Endpoints:

- `GET /songs/page?offset&count&mode&heard`: the list as today, filtered, newest first, with `total` counting the matches.
- `GET /songs/options?mode&heard`: both filters' options, each counted given the *other* filter:

  ```json
  {
    "modes": [{ "value": "dorian", "label": "Dorian", "count": 12 }],
    "heard": [
      { "value": "plainly", "label": "plainly", "count": 140 },
      { "value": "progression-chorus-homecoming", "label": "A chorus coming home", "count": 4 }
    ]
  }
  ```

  A Perspective's label is its newest title. The queries are a couple of `group by`s over the indexed columns.

## The window

- The two filters and the summary line sit above the list, as described above. Each starts on "any".
- Choosing reloads the list from the first page and the other filter's counts. The paging and the "tune live" row work as now.
- The chosen filters are kept in the address (`?mode=dorian&heard=progression-chorus-homecoming`), so a search can be shared and survives a reload.
- The filters are hidden when `/songs/options` doesn't answer, so a Radio without its cache still shows its list.

## What moves

- **`.khz-k3s/`**: the `postgresql` resource; the Radio's env from the operator's Secret; `kustomization.yaml` gains the resource.
- **`packages/radio/lib/cache.ts`** (new): the schema, filling from the Archive and Tactus, and the queries.
- **`packages/radio/index.ts`**: `/songs/page` with filters, `/songs/options`, and the fallback when the cache is away.
- **`packages/ui/public/index.js`** and the page: the two filters, the summary line, and the filters in the address.

## Order of work

1. The cache in the Radio, tested against a local Postgres on xitra if one can run there, and otherwise against Bun's SQL with a test database. The fallback is tested with the database away.
2. The `postgresql` resource and the Radio's env in `.khz-k3s/`. Check after Argo syncs that the Radio fills its cache from every aired Song.
3. The API: filters, and options counted given the other filter.
4. The filters in the window. Check on a phone-sized screen as well as a wide one, by finding the homecoming Songs.
