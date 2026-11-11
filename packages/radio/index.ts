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
//   GET /pulse      whether the song is alive (200) or not (503)
//   GET /           the Receiver, for a browser

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getEnv } from 'tools'
import { paths, sessionVersion, type ArchiveIndex, type Session } from 'archive'
import { endOf, Tactus, type Airing } from './lib/tactus.js'

const { SERVER_PORT, ARCHIVE_URL, ARCHIVE_PORT, PUBLIC_ARCHIVE_URL } = getEnv()

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

async function read<T>(path: string): Promise<T | undefined> {
  try {
    const response = await fetch(new URL(path, ARCHIVE_URL), {
      signal: AbortSignal.timeout(10_000),
    })
    return response.ok ? ((await response.json()) as T) : undefined
  } catch {
    return undefined
  }
}

/** Looks in the Archive for the next Song, and announces it when it is there. */
async function listen() {
  if (tactus.next) return
  const index = await read<ArchiveIndex>(paths.index)
  const song = index && tactus.candidate(index.songs)
  if (!song) return
  const session = await read<Session>(paths.session(song))
  if (!session || session.version !== sessionVersion) return
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

/** Where a Receiver that reached the Radio at `host` finds the Archive. */
function archiveFor(request: Request) {
  if (PUBLIC_ARCHIVE_URL) return PUBLIC_ARCHIVE_URL
  const url = new URL(request.url)
  const host = request.headers.get('host')?.replace(/:\d+$/, '') ?? url.hostname
  return `${url.protocol}//${host}:${ARCHIVE_PORT}/`
}

const told = (airing: Airing | undefined, archive: string) =>
  airing && {
    song: airing.song,
    session: new URL(paths.session(airing.song), archive).href,
    archive,
    begins: airing.begins,
    seconds: airing.seconds,
  }

const open = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Cache-Control': 'no-store',
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: open })

const page = fileURLToPath(new URL('../ui/public/', import.meta.url))
const pageFiles = new Set(['index.html', 'index.js', 'favicon.ico'])

Bun.serve({
  port: SERVER_PORT,
  hostname: '0.0.0.0',
  async fetch(request) {
    const url = new URL(request.url)
    const archive = archiveFor(request)

    if (url.pathname === '/tactus') {
      return json({
        now: Date.now(),
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

    const name = url.pathname === '/' ? 'index.html' : normalize(url.pathname).slice(1)
    if (pageFiles.has(name)) {
      return new Response(Bun.file(join(page, name)), {
        headers: { 'Cache-Control': 'no-cache' },
      })
    }
    return new Response(null, { status: 404 })
  },
})

console.log(`The Radio is on at http://127.0.0.1:${SERVER_PORT}/`)

function rest(signal: string) {
  console.log(`The Radio rests (${signal}). The Tactus is remembered.`)
  process.exit(0)
}
process.on('SIGTERM', () => rest('SIGTERM'))
process.on('SIGINT', () => rest('SIGINT'))
