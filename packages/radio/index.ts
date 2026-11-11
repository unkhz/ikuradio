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
//   GET /songs/page every Song received, the one on now first, a slice at a time
//   GET /pulse      whether the song is alive (200) or not (503)
//   GET /           the Receiver, for a browser
//   GET /s/<n>      the Receiver, tuned to Song n from its beginning

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { normalize } from 'node:path'
import pageHtmlFile from '../ui/public/index.html' with { type: 'file' }
// @ts-expect-error: the page's script is plain JavaScript, imported only as a file
import pageJsFile from '../ui/public/index.js' with { type: 'file' }
import pageIcon from '../ui/public/favicon.ico' with { type: 'file' }
import pageReceiver from '../ui/public/receiver.svg' with { type: 'file' }
import pageCard from '../ui/public/card.png' with { type: 'file' }
import { getEnv } from 'tools'
import { archiveAddress, paths, publicArchive, sessionVersion, type ArchiveIndex, type Session } from 'archive'
import { endOf, Tactus, type Airing } from './lib/tactus.js'

const { SERVER_PORT } = getEnv()

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

/** A Session, if the Archive still holds the Recordings it names: a Song it can still play. */
async function playable(song: string): Promise<Session | undefined> {
  const session = await read<Session>(paths.session(song))
  if (!session || session.version !== sessionVersion) return undefined
  const [first] = session.recordings
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
 * Archive can still play it. The Archive keeps the words of many Songs for
 * looking back, but the Recordings of only the newest few; a Radio that has
 * fallen far behind, or has forgotten what it aired, takes up the oldest of
 * the Songs that can still be heard, and lets the others go.
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
  await mkdir('memory', { recursive: true })
  await appendFile(memory, `${JSON.stringify(airing)}\n`)
  const late = Math.max(0, airing.begins - Date.now()) / 1000
  console.log(
    `Song ${BigInt(song) + 1n} announced: ${(session.seconds / 60).toFixed(1)} minutes, begins in ${late.toFixed(0)}s`,
  )
}

await listen()
setInterval(listen, 2000)


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
  'favicon.ico': { file: pageIcon, type: 'image/x-icon' },
  'receiver.svg': { file: pageReceiver, type: 'image/svg+xml' },
  'card.png': { file: pageCard, type: 'image/png' },
}

// How the page is told about, when a link to it is shared: by the Radio,
// for every page, so a link to a Song says which Song it is.
const pageText = await Bun.file(pageHtml).text()
const site = 'Song that never ends'
const telling = 'A lost receiver, adrift online, still tuned to a song that never ends.'
const escaped = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

async function page(request: Request, url: URL, song?: bigint) {
  // behind Cloudflare and Traefik the Radio is reached over https, whatever it sees
  const scheme = request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1)
  const origin = `${scheme}://${request.headers.get('host') ?? url.host}`
  let title = site
  let description = telling
  if (song !== undefined) {
    const named = (song + 1n).toLocaleString('en')
    title = `Song ${named} · ${site}`
    const session = tactus.history.some((a) => a.song === `${song}` && a.begins <= Date.now())
      ? await read<Session>(paths.session(`${song}`))
      : undefined
    if (session) {
      description =
        `${session.mood.join(' + ')}: ${session.mode}, ${session.tempo} bpm, sung by ${session.choir}.` +
        ` ${Math.round(session.seconds / 60)} minutes, received from far away.`
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
  return new Response(pageText.replace(/<!--meta-->[\s\S]*<!--\/meta-->/, meta), {
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

    if (url.pathname === '/songs/page') {
      // every Song received so far, newest first, the one on now among them:
      // for now an array, and a page is a slice of it
      const now = Date.now()
      const received = tactus.history.filter((a) => a.begins <= now).reverse()
      const total = received.length
      const offset = Math.min(total, Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0)))
      const count = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get('count')) || 12)))
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
          song: playing ? `${BigInt(playing.song) + 1n}` : undefined,
          beganAgo: playing ? Math.round((Date.now() - playing.begins) / 1000) : undefined,
          lasts: playing ? Math.round(playing.seconds) : undefined,
        },
        pulse.alive ? 200 : 503,
      )
    }

    if (url.pathname === '/' || url.pathname === '/index.html') return page(request, url)
    const asked = /^\/s\/(\d{1,400})\/?$/.exec(url.pathname)
    if (asked) return page(request, url, BigInt(asked[1]) > 0n ? BigInt(asked[1]) - 1n : undefined)

    const name = normalize(url.pathname).slice(1)
    const part = pageFiles[name]
    if (part) {
      return new Response(Bun.file(part.file), {
        headers: { 'Content-Type': part.type, 'Cache-Control': 'no-cache' },
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
