// The Radio: a long life, spent keeping time.
//
// It never touches a Recording. It watches the Archive for Songs the Studio
// has finished, announces each one with the moment it will begin, and tells
// anyone who asks what is playing, what comes next, where to fetch them, and
// what time it is. Receivers do the rest.
//
//   bun run radio
//
//   GET /tactus     the time, and the Songs playing and coming, with links to their Sessions,
//                   and the versions: the Radio's release, and the Archive's
//   GET /songs      Songs that have aired, newest first, for looking back
//   GET /songs/page every Song received, the one on now first, a slice at a time,
//                   found by mode and by how it was heard (?mode=dorian&heard=plainly|<slug>)
//   GET /songs/options  both filters' options, each counted given the other
//   GET /songs/after?song=<n>  what follows Song n for someone hearing Songs again: the next aired, or live
//   GET /pulse      whether the song is alive (200) or not (503)
//   GET /           the Receiver, for a browser
//   GET /s/<n>/<slug>  the Receiver, tuned to Song n from its beginning: its only address
//   GET /sitemap.xml  the address of every Song received that has its intro, and nothing else

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { normalize } from 'node:path'
// The Receiver's page, built by packages/ui/build.ts before the Radio is: each
// file named by a hash of what it holds, every one imported as a file, so the
// executable that is compiled carries them. Run `bun run receiver` first.
// @ts-ignore: written by the Receiver's build, and not there until it has run
import { files as pageFiles, named as pageNames, release } from '../ui/dist/receiver.js'
import { getEnv } from 'tools'
import { addressAsked } from './lib/address.js'
import { archiveAddress, isSynthesized, linkOf, paths, publicArchive, sessionVersion, slugOf, type ArchiveIndex, type DjDeclaration, type Session } from 'archive'
import { endOf, Tactus, type Airing } from './lib/tactus.js'
import { SongCache } from './lib/cache.js'
import { favouriteSongs, inTurn } from './lib/favourites.js'
import critic from '../../critic/scientist.json' with { type: 'json' }
import { Introduced, sitemapOf } from './lib/sitemap.js'
import { aboutOf, cardOf, excerptOf, headlineOf, playlistExcerptOf, speak, speakPlaylist, type Card, type PlaylistEntry } from './lib/speaks.js'
import { decodePlaylist, playlistAsked, playlistJsonAsked } from './lib/playlist.js'

const { SERVER_PORT, CACHE_PATH } = getEnv()

const memory = 'memory/tactus.jsonl'

/** What the Radio remembers: every Song it has announced, and when. */
async function remember(): Promise<Airing[]> {
  try {
    return (await readFile(memory, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Airing)
      .slice(-5000)
  } catch {
    return []
  }
}

const tactus = new Tactus(await remember())

/** Where the Radio reads the Archive from, and where it sends Receivers to fetch. */
const reading = archiveAddress()
const sending = publicArchive()

async function read<T>(path: string): Promise<T | undefined> {
  try {
    const response = await fetch(new URL(path, reading), {
      signal: AbortSignal.timeout(10_000),
    })
    return response.ok ? ((await response.json()) as T) : undefined
  } catch {
    return undefined
  }
}

/**
 * A Session by its number: found, certainly not there (the Archive says 404), or not known for now,
 * because the Archive did not answer in time or well. A Song that is there is never said to be
 * missing for the Archive's stumble.
 */
async function sessionOf(song: string): Promise<{ found: Session } | 'missing' | 'unknown'> {
  try {
    const response = await fetch(new URL(paths.session(song), reading), { signal: AbortSignal.timeout(10_000) })
    if (response.ok) return { found: (await response.json()) as Session }
    return response.status === 404 || response.status === 403 ? 'missing' : 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * A Session, if the Archive still holds the Recordings it names: a Song it
 * can still play. Voices sung from takes are never in the Archive's
 * recordings, so only a Recording kept as sound is looked for.
 */
async function playable(song: string): Promise<Session | undefined> {
  const session = await read<Session>(paths.session(song))
  if (!session || session.version !== sessionVersion) return undefined
  const first = session.recordings.find((recording) => !isSynthesized(recording))
  if (!first) return session
  try {
    const response = await fetch(new URL(paths.recording(first.id), reading), {
      method: 'HEAD',
      signal: AbortSignal.timeout(10_000),
    })
    return response.ok ? session : undefined
  } catch {
    return undefined
  }
}

/**
 * Which Song to announce next: the first after the last one aired, if the
 * Archive can play it. The Archive keeps everything, but a few early Songs
 * lost their voices before it did; a Radio that comes to one of those takes
 * up the oldest of the later Songs that can still be heard.
 */
async function nextPlayable(songs: readonly string[]) {
  const later = tactus.candidates(songs)
  const [first] = later
  if (first === undefined) return undefined
  const ready = await playable(first)
  if (ready) return { song: first, session: ready }
  let found: { song: string; session: Session } | undefined
  for (const song of [...later].reverse()) {
    const session = await playable(song)
    if (!session) break
    found = { song, session }
  }
  return found
}

/**
 * The next encore: the favourite after the last one aired, if the Archive
 * can play it; a favourite it cannot is passed over for the next, and with
 * none the gap stays.
 */
async function nextFavourite() {
  for (const song of inTurn(favouriteSongs(critic), tactus.encores.at(-1)?.song)) {
    const session = await playable(song)
    if (session) return { song, session }
  }
  return undefined
}

/**
 * Looks in the Archive for the next Song, and announces it when it is there.
 * When no new Song can be played, and the song is about to fall silent, an
 * encore is announced instead: a new Song that comes while one is aired
 * begins after it has ended.
 */
async function listen() {
  if (tactus.next) return
  const index = await read<ArchiveIndex>(paths.index)
  const found = index && (await nextPlayable(index.songs))
  const encore = !found && tactus.hungry ? await nextFavourite() : undefined
  const chosen = found ?? encore
  if (!chosen) return
  const { song, session } = chosen
  const airing = encore ? tactus.announce(song, session.seconds, { setup: 'favourites' }) : tactus.announce(song, session.seconds)
  if (!airing) return
  void keepCache()
  await mkdir('memory', { recursive: true })
  await appendFile(memory, `${JSON.stringify(airing)}\n`)
  const late = Math.max(0, airing.begins - Date.now()) / 1000
  console.log(
    `${encore ? 'Encore: Song' : 'Song'} ${song} announced: ${(session.seconds / 60).toFixed(1)} minutes, begins in ${late.toFixed(0)}s`,
  )
}

// The cache of the Songs received, for searching them. The song never waits
// for it: it is filled in the background, and while it is away the list is
// read from the Tactus, without search.
const cache = (() => {
  try {
    return new SongCache(CACHE_PATH)
  } catch (error) {
    console.warn(`the cache of the Songs received cannot be kept at ${CACHE_PATH}: ${(error as Error).message}`)
    return undefined
  }
})()
/** Whether the cache answered last time it was asked. */
let cached = false
let keeping = false
/** Readies the cache if it was away, and fills in every Song announced that it does not hold. */
async function keepCache() {
  if (!cache || keeping) return
  keeping = true
  try {
    if (!cached) {
      await cache.prepare()
      cached = true
      console.log('the cache of the Songs received is there')
    }
    const added = await cache.fill(tactus.history, (song) => read<Session>(paths.session(song)))
    if (added) console.log(`the cache keeps ${added} more Songs`)
    // a Song kept without a name may have been named since it was kept: the
    // names worn, and the Sessions of the Songs they name, read again
    const names = await read<Record<string, string>>(paths.names)
    if (names) {
      const found = await cache.renamed(new Set(Object.values(names)), (song) => read<Session>(paths.session(song)))
      if (found) console.log(`the cache has found names for ${found} more Songs`)
    }
  } catch (error) {
    if (cached) console.warn(`the cache of the Songs received is away: ${(error as Error).message}`)
    cached = false
  } finally {
    keeping = false
  }
}

/**
 * The Songs known to have their intro, for the sitemap. The Songs received are asked about, the
 * ones not yet known to have it, now and again: an intro is made after its Song has aired.
 */
const introduced = new Introduced()
/** Whether the Songs have been asked about once, so that the sitemap is what is known and not what is yet to be learnt. */
let learnedOnce = false
let learning: Promise<void> | undefined
function learnIntros() {
  learning ??= (async () => {
    try {
      const received = tactus.history.filter((a) => a.mode !== 'encore' && a.begins <= Date.now()).map((a) => a.song)
      const learned = await introduced.learn(received, (song) => read<DjDeclaration>(paths.dj('rezzy', song)))
      if (learned) console.log(`${learned} more Songs have their intro: ${introduced.size} for the sitemap`)
      learnedOnce = true
    } finally {
      learning = undefined
    }
  })()
  return learning
}

/**
 * The Archive's version, as it was last read: nothing, until it has been, or
 * if the Archive keeps none. Told in the Tactus beside the Radio's release, so
 * a Receiver knows when what it holds of either is old.
 */
let archiveVersion: string | null = null
async function readVersion() {
  const stamp = await read<{ version?: string }>(paths.version)
  if (stamp?.version) archiveVersion = stamp.version
}

await Promise.all([readVersion(), listen()])
setInterval(listen, 2000)
setInterval(readVersion, 15_000)
void keepCache()
const firstIntros = learnIntros()
setInterval(() => void learnIntros(), 10 * 60_000)
setInterval(keepCache, 60_000)


/** What a search asks for, if it asks for something that could be there. */
const searchOf = (url: URL) => {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 160)
  const mode = url.searchParams.get('mode') ?? ''
  const heard = url.searchParams.get('heard') ?? ''
  return {
    ...(q ? { q } : {}),
    ...(/^[a-z]{1,40}$/.test(mode) ? { mode } : {}),
    ...(/^[a-z0-9-]{1,100}$/.test(heard) ? { heard } : {}),
  }
}


const told = (airing: Airing | undefined, archive: string) =>
  airing && {
    song: airing.song,
    session: new URL(paths.session(airing.song), archive).href,
    archive,
    begins: airing.begins,
    seconds: airing.seconds,
    // the mode the Tactus declares for it, and in an encore what chose it
    mode: airing.mode ?? 'live',
    ...(airing.setup ? { setup: airing.setup } : {}),
  }

/** What a list of Songs shows of each: its name and its weather, read once from its Session. */
const summaries = new Map<string, { mood: string[]; name?: string; slug?: string }>()
async function summary(song: string) {
  if (!summaries.has(song)) {
    const session = await read<Session>(paths.session(song))
    if (session)
      summaries.set(song, {
        mood: session.mood,
        ...(session.name ? { name: session.name, slug: slugOf(session.name) } : {}),
      })
  }
  return summaries.get(song)
}

const open = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Cache-Control': 'no-store',
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: open })

// The Receiver's page is carried inside the Radio: from its files here, and
// inside the executable when the Radio is compiled into one. `pageFiles` is
// the built page by the names it is served by; `pageNames` is what each file
// is called by hand, and what it is served by now.
const files = pageFiles as Record<string, { file: string; type: string; immutable: boolean }>
const names = pageNames as Record<string, string>
const pageHtml = files[names['index.html']!]!.file
const releaseOf = release as string

// How the page is told about, when a link to it is shared: by the Radio,
// for every page, so a link to a Song says which Song it is.
const pageText = await Bun.file(pageHtml).text()
const site = 'ikuradio'
const telling = 'A lost receiver, adrift online, still tuned to a song that never ends.'
const escaped = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/**
 * What a Song's page tells of it, by its number, for the Songs whose pages
 * were last asked for. A Session never changes once it is published, so
 * what was read once is kept; only its card is, a few hundred bytes, never
 * the Session with all its takes.
 */
const cards = new Map<string, { card: Card; introAsked: number }>()
const keptCards = 500
/** A Song with no intro made is asked again after this long, in milliseconds: its intro is made after it has aired. */
const introAskedAgainAfter = 10 * 60_000
/** What Rezzy says to introduce a Song, if an intro has been made. */
const introOf = async (song: string) => (await read<DjDeclaration>(paths.dj('rezzy', song)))?.parts.intro?.speech.text
async function cardFor(song: string): Promise<Card | undefined> {
  const kept = cards.get(song)
  if (kept) {
    if (!kept.card.intro && Date.now() - kept.introAsked > introAskedAgainAfter) {
      const intro = await introOf(song)
      kept.introAsked = Date.now()
      if (intro?.trim()) kept.card = { ...kept.card, intro: intro.trim() }
    }
    // the newest asked is the last let go
    cards.delete(song)
    cards.set(song, kept)
    return kept.card
  }
  const [session, intro] = await Promise.all([read<Session>(paths.session(song)), introOf(song)])
  if (!session) return undefined
  const card = cardOf(session, intro)
  cards.set(song, { card, introAsked: Date.now() })
  if (cards.size > keptCards) cards.delete(cards.keys().next().value!)
  return card
}

async function page(request: Request, url: URL, song?: bigint) {
  // behind Cloudflare and Traefik the Radio is reached over https, whatever it sees
  const scheme = request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1)
  const origin = `${scheme}://${request.headers.get('host') ?? url.host}`
  let title = site
  let description = telling
  // only a Song that has aired is told about: nothing from the future
  let card: Card | undefined
  if (song !== undefined) {
    card = tactus.history.some((a) => a.song === `${song}` && a.begins <= Date.now()) ? await cardFor(`${song}`) : undefined
    title = card ? headlineOf(card, site) : `Song ${song.toLocaleString('en')} · ${site}`
    // and excerpted by its intro, the words Rezzy says of it, when an intro has been made
    if (card) description = excerptOf(card)
  }
  const meta = [
    `<title>${escaped(title)}</title>`,
    `<meta name="description" content="${escaped(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escaped(site)}" />`,
    `<meta property="og:title" content="${escaped(title)}" />`,
    `<meta property="og:description" content="${escaped(description)}" />`,
    // one address for a page, whatever ?promo= or ?intro= a capture put after it
    `<link rel="canonical" href="${escaped(origin + url.pathname)}" />`,
    `<meta property="og:url" content="${escaped(origin + url.pathname)}" />`,
    `<meta property="og:image" content="${escaped(`${origin}/${names['card.png']}`)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="A lost receiver from another world, a little broken" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escaped(title)}" />`,
    `<meta name="twitter:description" content="${escaped(description)}" />`,
  ].join('\n    ')
  const told = speak(aboutOf(pageText.replace(/<!--meta-->[\s\S]*<!--\/meta-->/, () => meta), description), card, origin + url.pathname)
  return new Response(told, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
}

/** Resolves a base36 playlist slug into aired Songs, or 'missing' / 'unknown'. Nothing from the future is ever exposed. */
async function resolvePlaylist(slug: string): Promise<{ entries: PlaylistEntry[] } | 'missing' | 'unknown'> {
  const ids = decodePlaylist(slug)
  if (!ids) return 'missing'
  const now = Date.now()
  const aired = new Set(tactus.history.filter((a) => a.begins <= now).map((a) => a.song))
  for (const song of ids) {
    if (!aired.has(song)) return 'missing'
  }
  const unique = [...new Set(ids)]
  const loaded = new Map<string, Card>()
  const missing: string[] = []
  for (const song of unique) {
    const kept = cards.get(song)?.card
    if (kept) loaded.set(song, kept)
    else missing.push(song)
  }
  if (missing.length) {
    const fetched = await Promise.all(missing.map(async (song) => [song, await sessionOf(song)] as const))
    for (const [song, got] of fetched) {
      if (got === 'unknown') return 'unknown'
      if (got === 'missing') return 'missing'
      loaded.set(song, cardOf(got.found))
    }
  }
  const entries: PlaylistEntry[] = ids.map((song) => {
    const card = loaded.get(song)!
    return {
      song,
      ...(card.name ? { name: card.name, slug: slugOf(card.name) } : {}),
      arrangement: card.arrangement,
      seconds: card.seconds,
    }
  })
  return { entries }
}

async function playlistPage(request: Request, url: URL, entries: readonly PlaylistEntry[]) {
  const scheme = request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1)
  const origin = `${scheme}://${request.headers.get('host') ?? url.host}`
  const count = `${entries.length} Song${entries.length === 1 ? '' : 's'}`
  const title = `Playlist · ${count} · ${site}`
  const description = playlistExcerptOf(entries)
  const meta = [
    `<title>${escaped(title)}</title>`,
    `<meta name="description" content="${escaped(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escaped(site)}" />`,
    `<meta property="og:title" content="${escaped(title)}" />`,
    `<meta property="og:description" content="${escaped(description)}" />`,
    `<link rel="canonical" href="${escaped(origin + url.pathname)}" />`,
    `<meta property="og:url" content="${escaped(origin + url.pathname)}" />`,
    `<meta property="og:image" content="${escaped(`${origin}/${names['card.png']}`)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="A lost receiver from another world, a little broken" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escaped(title)}" />`,
    `<meta name="twitter:description" content="${escaped(description)}" />`,
  ].join('\n    ')
  const told = speakPlaylist(
    aboutOf(pageText.replace(/<!--meta-->[\s\S]*<!--\/meta-->/, () => meta), description),
    entries,
    origin + url.pathname,
  )
  return new Response(told, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
}

Bun.serve({
  port: SERVER_PORT,
  hostname: '0.0.0.0',
  fetch: (request) => answer(request),
})

/** The Radio's answer to a request. */
async function answer(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const archive = sending

  if (url.pathname === '/tactus') {
    return json({
      now: Date.now(),
      archive,
      // the versions a Receiver compares with what it holds
      release: releaseOf,
      archiveVersion,
      playing: told(tactus.playing, archive) ?? null,
      next: told(tactus.next, archive) ?? null,
    })
  }

  if (url.pathname === '/songs') {
    // Songs that have aired to the end, newest first: nothing before its time
    const before = url.searchParams.get('before')
    const count = Math.min(30, Math.max(1, Number(url.searchParams.get('count')) || 12))
    const now = Date.now()
    const aired = tactus.history
      .filter((a) => endOf(a) <= now)
      .filter((a) => !before || !/^\d{1,400}$/.test(before) || BigInt(a.song) < BigInt(before))
      .slice(-count)
      .reverse()
    return json(aired.map((a) => told(a, archive)))
  }

  if (url.pathname === '/songs/after') {
    const song = url.searchParams.get('song') ?? ''
    if (!/^\d{1,400}$/.test(song)) return json({ error: 'a Song is asked for by its number' }, 400)
    const next = tactus.after(song)
    // a Song is asked for by its number, and answered with its link: without
    // a name it cannot be, and it is not aired then
    if ('song' in next) {
      const held = await summary(next.song)
      if (!held?.slug) return json({ live: true })
      return json({ ...next, name: held.name, slug: held.slug })
    }
    return json(next)
  }

  if (url.pathname === '/songs/options') {
    if (cache && cached) {
      try {
        return json(await cache.options(searchOf(url)))
      } catch (error) {
        console.warn(`the cache of the Songs received is away: ${(error as Error).message}`)
        cached = false
      }
    }
    // without its cache the Radio offers no search, and the page hides it
    return json({ error: 'no search without the cache' }, 503)
  }

  if (url.pathname === '/songs/page') {
    // every Song received so far, newest first, the one on now among them,
    // found in the cache by what was asked; without it, from the Tactus, all of them
    const now = Date.now()
    const requested = Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0))
    const count = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get('count')) || 12)))
    if (cache && cached) {
      try {
        return json({ ...(await cache.page(searchOf(url), requested, count, now)), searched: true })
      } catch (error) {
        console.warn(`the cache of the Songs received is away: ${(error as Error).message}`)
        cached = false
      }
    }
    const received = tactus.history.filter((a) => a.begins <= now).reverse()
    const total = received.length
    const offset = Math.min(total, requested)
    const songs = await Promise.all(
      received.slice(offset, offset + count).map(async (a) => ({
        song: a.song,
        begins: a.begins,
        seconds: a.seconds,
        on: endOf(a) > now,
        ...(await summary(a.song)),
      })),
    )
    return json({ total, offset, songs })
  }

  if (url.pathname === '/pulse') {
    const pulse = tactus.pulse()
    const playing = tactus.playing
    return json(
      {
        ...pulse,
        song: playing ? playing.song : undefined,
        beganAgo: playing ? Math.round((Date.now() - playing.begins) / 1000) : undefined,
        lasts: playing ? Math.round(playing.seconds) : undefined,
      },
      pulse.alive ? 200 : 503,
    )
  }

  if (url.pathname === '/sitemap.xml') {
    // every Song's address, and nothing else: the Songs received that have their intro, which is
    // every Song a search may quote by Rezzy's words, and no Song by its number alone. The first
    // time it is asked for, it waits a little for the Songs to have been asked about
    await Promise.race([firstIntros, new Promise((resolve) => setTimeout(resolve, 20_000))])
    // a Radio that has only just begun has not yet asked: an empty list now would be taken (and kept) for the whole list, so it says 'later'
    if (!learnedOnce) return new Response(null, { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } })
    const names = await read<Record<string, string>>(paths.names)
    const slugs = new Map<string, string>()
    for (const [slug, song] of Object.entries(names ?? {})) slugs.set(song, slug)
    const origin = `${request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1)}://${request.headers.get('host') ?? url.host}`
    const received = tactus.history.filter((a) => a.mode !== 'encore' && a.begins <= Date.now()).map((a) => a.song)
    return new Response(sitemapOf(origin, received, introduced, slugs), {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    })
  }
  // everyone may look; where the Songs are listed is said, so that a crawler need not guess it
  if (url.pathname === '/robots.txt') {
    const scheme = request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1)
    return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${scheme}://${request.headers.get('host') ?? url.host}/sitemap.xml\n`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'max-age=3600' },
    })
  }
  if (url.pathname === '/' || url.pathname === '/index.html') return page(request, url)
  const askedPlaylistJson = playlistJsonAsked(url.pathname)
  if (askedPlaylistJson) {
    const got = await resolvePlaylist(askedPlaylistJson)
    if (got === 'unknown') return json({ error: 'the Archive did not answer' }, 503)
    if (got === 'missing') return json({ error: 'playlist not found' }, 404)
    return json({
      slug: askedPlaylistJson,
      archive,
      songs: got.entries.map((entry) => ({
        ...entry,
        session: new URL(paths.session(entry.song), archive).href,
      })),
    })
  }
  const askedPlaylist = playlistAsked(url.pathname)
  if (askedPlaylist) {
    const got = await resolvePlaylist(askedPlaylist)
    if (got === 'unknown') return new Response(null, { status: 503, headers: { 'retry-after': '5' } })
    if (got === 'missing') return new Response(null, { status: 404 })
    return playlistPage(request, url, got.entries)
  }
  // A Song's only address: its number, and the slug its name makes. A wrong
  // slug is not found, like any path that is not the link: the Radio says
  // nothing of a Song it does not link.
  const asked = addressAsked(url.pathname)
  if (asked) {
    const got = asked.song !== '0' ? await sessionOf(asked.song) : 'missing'
    // the Archive did not answer: the Song may well be there, so say "later", not "never"
    if (got === 'unknown') return new Response(null, { status: 503, headers: { 'retry-after': '5' } })
    const session = got === 'missing' ? undefined : got.found
    if (session?.name && linkOf(session)?.slug === asked.slug) return page(request, url, BigInt(asked.song))
    return new Response(null, { status: 404 })
  }

  const name = normalize(url.pathname).slice(1)
  const part = Object.hasOwn(files, name) ? files[name] : Object.hasOwn(names, name) ? files[names[name]!] : undefined
  if (part) {
    // a file asked for by the name its hash gives it never changes: kept as
    // long as the browser likes. One asked for by the name it was once given
    // by hand, or one that keeps its name, is asked after each time
    const cache = part.immutable && Object.hasOwn(files, name) ? 'public, max-age=31536000, immutable' : 'no-cache'
    return new Response(Bun.file(part.file), {
      headers: { 'Content-Type': part.type, 'Cache-Control': cache },
    })
  }
  return new Response(null, { status: 404 })
}

console.log(`The Radio is on, on port ${SERVER_PORT}, reading the Archive at ${reading}`)

function rest(signal: string) {
  console.log(`The Radio rests (${signal}). The Tactus is remembered.`)
  process.exit(0)
}
process.on('SIGTERM', () => rest('SIGTERM'))
process.on('SIGINT', () => rest('SIGINT'))
