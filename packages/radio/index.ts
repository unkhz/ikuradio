// The Radio: a long life, spent keeping time.
//
// It never touches a Recording. It watches the Archive for Songs the Studio
// has finished, announces each one with the moment it will begin, and tells
// anyone who asks what is playing, what comes next, where to fetch them, and
// what time it is. Receivers do the rest.
//
//   bun run radio
//
//   GET /tactus     the time, and the Songs playing and coming, with links to their Sessions
//   GET /songs      Songs that have aired, newest first, for looking back
//   GET /songs/page every Song received, the one on now first, a slice at a time,
//                   found by mode and by how it was heard (?mode=dorian&heard=plainly|<slug>)
//   GET /songs/options  both filters' options, each counted given the other
//   GET /pulse      whether the song is alive (200) or not (503)
//   GET /           the Receiver, for a browser
//   GET /s/<n>      the Receiver, tuned to Song n from its beginning

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { normalize } from 'node:path'
import pageHtmlFile from '../ui/public/index.html' with { type: 'file' }
// @ts-expect-error: the page's script is plain JavaScript, imported only as a file
import pageJsFile from '../ui/public/index.js' with { type: 'file' }
// @ts-expect-error: the page's space is plain JavaScript, imported only as a file
import pageSpaceFile from '../ui/public/space.js' with { type: 'file' }
// @ts-expect-error: the page's measure of its lines is built JavaScript, imported only as a file
import pageVersesFile from '../ui/public/verses.js' with { type: 'file' }
import pageIcon from '../ui/public/favicon.ico' with { type: 'file' }
import pageReceiver from '../ui/public/receiver.svg' with { type: 'file' }
import pageCard from '../ui/public/card.png' with { type: 'file' }
import pageWordmark from '../ui/public/wordmark.svg' with { type: 'file' }
import pageManifest from '../ui/public/manifest.webmanifest' with { type: 'file' }
import pageAppIcon from '../ui/public/icon-512.png' with { type: 'file' }
import pageSmallAppIcon from '../ui/public/icon-192.png' with { type: 'file' }
import pageTouchIcon from '../ui/public/apple-touch-icon.png' with { type: 'file' }
import pageFont from '../ui/public/fonts/doto.woff2' with { type: 'file' }
import pageFontLicense from '../ui/public/fonts/DOTO-LICENSE.txt' with { type: 'file' }
// @ts-expect-error: the page's throat is plain JavaScript, imported only as a file
import pageThroatFile from '../ui/public/throat.js' with { type: 'file' }
// @ts-expect-error: the throat's worker is plain JavaScript, imported only as a file
import pageThroatWorkerFile from '../ui/public/throat-worker.js' with { type: 'file' }
import pageThroatEngine from '../ui/public/throat/chimera.wasm' with { type: 'file' }
import pageThroatWords from '../ui/public/throat/cmudict.txt.gz' with { type: 'file' }
import pageThroatWordsLicense from '../ui/public/throat/CMUDICT-LICENSE.txt' with { type: 'file' }
import { getEnv } from 'tools'
import { archiveAddress, paths, publicArchive, sessionVersion, type ArchiveIndex, type Session } from 'archive'
import { endOf, Tactus, type Airing } from './lib/tactus.js'
import { SongCache } from './lib/cache.js'
import { cardOf, speak, type Card } from './lib/speaks.js'

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
 * A Session, if the Archive still holds the Recordings it names: a Song it
 * can still play. Voices sung from takes are never in the Archive's
 * recordings, so only a Recording kept as sound is looked for.
 */
async function playable(song: string): Promise<Session | undefined> {
  const session = await read<Session>(paths.session(song))
  if (!session || session.version !== sessionVersion) return undefined
  const first = session.recordings.find(({ take }) => !take)
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

/** Looks in the Archive for the next Song, and announces it when it is there. */
async function listen() {
  if (tactus.next) return
  const index = await read<ArchiveIndex>(paths.index)
  const found = index && (await nextPlayable(index.songs))
  if (!found) return
  const { song, session } = found
  const airing = tactus.announce(song, session.seconds)
  if (!airing) return
  void keepCache()
  await mkdir('memory', { recursive: true })
  await appendFile(memory, `${JSON.stringify(airing)}\n`)
  const late = Math.max(0, airing.begins - Date.now()) / 1000
  console.log(
    `Song ${song} announced: ${(session.seconds / 60).toFixed(1)} minutes, begins in ${late.toFixed(0)}s`,
  )
}

await listen()
setInterval(listen, 2000)

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
  } catch (error) {
    if (cached) console.warn(`the cache of the Songs received is away: ${(error as Error).message}`)
    cached = false
  } finally {
    keeping = false
  }
}
void keepCache()
setInterval(keepCache, 60_000)

/** What a search asks for, if it asks for something that could be there. */
const searchOf = (url: URL) => {
  const mode = url.searchParams.get('mode') ?? ''
  const heard = url.searchParams.get('heard') ?? ''
  return {
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
  }

/** What a list of Songs shows of each: its weather and its length, read once from its Session. */
const summaries = new Map<string, { mood: string[]; seconds: number }>()
async function summary(song: string) {
  if (!summaries.has(song)) {
    const session = await read<Session>(paths.session(song))
    if (session) summaries.set(song, { mood: session.mood, seconds: session.seconds })
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
// inside the executable when the Radio is compiled into one.
// imported `with { type: 'file' }`, each is the file's path, whatever the types say
const pageHtml = pageHtmlFile as unknown as string
const pageJs = pageJsFile as unknown as string
const pageFiles: Record<string, { file: string; type: string }> = {
  'index.html': { file: pageHtml, type: 'text/html; charset=utf-8' },
  'index.js': { file: pageJs, type: 'text/javascript; charset=utf-8' },
  'space.js': { file: pageSpaceFile as unknown as string, type: 'text/javascript; charset=utf-8' },
  'verses.js': { file: pageVersesFile as unknown as string, type: 'text/javascript; charset=utf-8' },
  'favicon.ico': { file: pageIcon, type: 'image/x-icon' },
  'receiver.svg': { file: pageReceiver, type: 'image/svg+xml' },
  'card.png': { file: pageCard, type: 'image/png' },
  'wordmark.svg': { file: pageWordmark, type: 'image/svg+xml' },
  // what a phone or a browser needs to keep the receiver as an app of its own
  'manifest.webmanifest': { file: pageManifest, type: 'application/manifest+json' },
  'icon-512.png': { file: pageAppIcon, type: 'image/png' },
  'icon-192.png': { file: pageSmallAppIcon, type: 'image/png' },
  'apple-touch-icon.png': { file: pageTouchIcon, type: 'image/png' },
  // the letters the page is set in, and their license
  'fonts/doto.woff2': { file: pageFont, type: 'font/woff2' },
  'fonts/DOTO-LICENSE.txt': { file: pageFontLicense, type: 'text/plain; charset=utf-8' },
  // the throat every Receiver sings with, and the words it reads; the
  // dictionary is sent as it is, gzipped, and unzipped by the page
  'throat.js': { file: pageThroatFile as unknown as string, type: 'text/javascript; charset=utf-8' },
  'throat-worker.js': { file: pageThroatWorkerFile as unknown as string, type: 'text/javascript; charset=utf-8' },
  'throat/chimera.wasm': { file: pageThroatEngine, type: 'application/wasm' },
  'throat/cmudict.txt.gz': { file: pageThroatWords, type: 'application/octet-stream' },
  'throat/CMUDICT-LICENSE.txt': { file: pageThroatWordsLicense, type: 'text/plain; charset=utf-8' },
}

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
const cards = new Map<string, Card>()
const keptCards = 500
async function cardFor(song: string): Promise<Card | undefined> {
  const kept = cards.get(song)
  if (kept) {
    // the newest asked is the last let go
    cards.delete(song)
    cards.set(song, kept)
    return kept
  }
  const session = await read<Session>(paths.session(song))
  if (!session) return undefined
  const card = cardOf(session)
  cards.set(song, card)
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
    const named = song.toLocaleString('en')
    title = `Song ${named} · ${site}`
    card = tactus.history.some((a) => a.song === `${song}` && a.begins <= Date.now()) ? await cardFor(`${song}`) : undefined
    if (card) {
      description =
        `${card.mood.join(' + ')}: ${card.mode}, ${card.tempo} bpm, sung by ${card.choir}.` +
        ` ${Math.round(card.seconds / 60)} minutes, received from far away.`
    }
  }
  const meta = [
    `<title>${escaped(title)}</title>`,
    `<meta name="description" content="${escaped(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escaped(site)}" />`,
    `<meta property="og:title" content="${escaped(title)}" />`,
    `<meta property="og:description" content="${escaped(description)}" />`,
    `<meta property="og:url" content="${escaped(origin + url.pathname)}" />`,
    `<meta property="og:image" content="${escaped(`${origin}/card.png`)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="A lost receiver from another world, a little broken" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ')
  const told = speak(pageText.replace(/<!--meta-->[\s\S]*<!--\/meta-->/, () => meta), card, origin + url.pathname)
  return new Response(told, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
}

Bun.serve({
  port: SERVER_PORT,
  hostname: '0.0.0.0',
  async fetch(request) {
    const url = new URL(request.url)
    const archive = sending

    if (url.pathname === '/tactus') {
      return json({
        now: Date.now(),
        archive,
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

    if (url.pathname === '/' || url.pathname === '/index.html') return page(request, url)
    const asked = /^\/s\/(\d{1,400})\/?$/.exec(url.pathname)
    if (asked) return page(request, url, BigInt(asked[1]) > 0n ? BigInt(asked[1]) : undefined)

    const name = normalize(url.pathname).slice(1)
    const part = pageFiles[name]
    if (part) {
      // the throat is two megabytes that change only when the throat is moved
      // on, and the letters, which change less: kept a day, so a listener who
      // comes back does not fetch them again
      const cache = name.startsWith('throat/') || name.startsWith('fonts/') ? 'public, max-age=86400' : 'no-cache'
      return new Response(Bun.file(part.file), {
        headers: { 'Content-Type': part.type, 'Cache-Control': cache },
      })
    }
    return new Response(null, { status: 404 })
  },
})

console.log(`The Radio is on, on port ${SERVER_PORT}, reading the Archive at ${reading}`)

function rest(signal: string) {
  console.log(`The Radio rests (${signal}). The Tactus is remembered.`)
  process.exit(0)
}
process.on('SIGTERM', () => rest('SIGTERM'))
process.on('SIGINT', () => rest('SIGINT'))
