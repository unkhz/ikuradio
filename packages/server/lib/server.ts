import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createServer as createHttpServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { Room } from './room.js'

const open = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Allow-Private-Network': 'true',
}

/** A recording's path, if the request names one: audio/<shelf>/<file>, and nothing outside it. */
export function recordingPath(url: string): string | undefined {
  const match = /\/audio\/([\w-]+)\/([\w-]+\.(?:m4a|mp3))$/.exec(
    url.split('?')[0],
  )
  return match ? `audio/${match[1]}/${match[2]}` : undefined
}

/** The page the song is listened to in, and the few files it is made of. */
const pageDir = () =>
  fileURLToPath(new URL('../../ui/public/', import.meta.url))
const page: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.js': { file: 'index.js', type: 'text/javascript; charset=utf-8' },
  '/favicon.ico': { file: 'favicon.ico', type: 'image/x-icon' },
}

async function isFile(path: string) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/** What can be read from the diary: the pages before an iteration, newest first. */
export type LookBack = (options: {
  before?: bigint
  count: number
}) => Promise<unknown[]>

/** The question in a request to look back: before which iteration, and how many. */
export function lookBackQuery(url: string): { before?: bigint; count: number } {
  const query = new URLSearchParams(url.split('?')[1] ?? '')
  const before = query.get('before')
  const count = Number(query.get('count') ?? 12)
  return {
    before: before && /^\d{1,400}$/.test(before) ? BigInt(before) : undefined,
    count: Number.isInteger(count) ? Math.min(30, Math.max(1, count)) : 12,
  }
}

/**
 * The door of the room. A request for a recording is given the recording.
 * A request for the page is given the page. A request to look back is read
 * a few pages of the diary. Anyone who asks to listen walks into the room
 * and hears the song. Nothing else is behind the door.
 */
export function createServer(room: Room, lookBack?: LookBack) {
  return createHttpServer(async (req, res) => {
    const url = (req.url ?? '/').split('?')[0]

    if (url === '/diary' && lookBack) {
      const pages = await lookBack(lookBackQuery(req.url ?? ''))
      res.writeHead(200, {
        ...open,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      return res.end(JSON.stringify(pages))
    }

    const path = recordingPath(url)
    if (path) {
      if (!(await isFile(path))) {
        // let go of already, or never sung
        res.writeHead(404, open)
        return res.end()
      }
      // a recording, once made, never changes: its name is its content
      const eTag = createHash('sha1').update(path).digest('hex')
      if (req.headers['if-none-match'] === eTag) {
        res.writeHead(304, open)
        return res.end()
      }
      res.writeHead(200, {
        ...open,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: eTag,
      })
      createReadStream(path).pipe(res)
      return
    }

    if (url === '/listen') {
      res.writeHead(200, {
        ...open,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      room.enter(res)
      return
    }

    const part = page[url]
    if (part) {
      res.writeHead(200, {
        'Content-Type': part.type,
        'Cache-Control': 'no-cache',
      })
      createReadStream(pageDir() + part.file).pipe(res)
      return
    }

    res.writeHead(404, open)
    res.end()
  })
}
