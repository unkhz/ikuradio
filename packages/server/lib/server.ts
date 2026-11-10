import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createServer as createHttpServer } from 'node:http'
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

async function isFile(path: string) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/**
 * The door of the room. A request for a recording is given the recording.
 * Any other request walks into the room and hears the song.
 */
export function createServer(room: Room) {
  return createHttpServer(async (req, res) => {
    const path = recordingPath(req.url ?? '')
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

    res.writeHead(200, {
      ...open,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    room.enter(res)
  })
}
