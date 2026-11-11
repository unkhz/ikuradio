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
import { normalize } from 'node:path'
import pageHtmlFile from '../ui/public/index.html' with { type: 'file' }
// @ts-expect-error: the page's script is plain JavaScript, imported only as a file
import pageJsFile from '../ui/public/index.js' with { type: 'file' }
import pageIcon from '../ui/public/favicon.ico' with { type: 'file' }
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
