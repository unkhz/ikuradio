// The Archive's door, while the Archive is a folder: a static file server,
// standing in for the cloud storage the song will one day keep its Songs in.
// It serves what is in the folder, and nothing else, to anyone who asks.
//
//   bun run archive

import { getEnv } from 'tools'
import { join, normalize } from 'node:path'

const { ARCHIVE_DIR, ARCHIVE_PORT, PUBLIC_HOST } = getEnv()

const open = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD',
  'Access-Control-Allow-Private-Network': 'true',
}

/** What may be asked for: the index, a Session, a Recording. Nothing outside the Archive. */
const allowed = /^\/(index\.json|sessions\/\d{1,400}\.json|recordings\/[0-9a-f]{64}\.m4a)$/

Bun.serve({
  port: ARCHIVE_PORT,
  hostname: '0.0.0.0',
  async fetch(request) {
    const { pathname } = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { headers: open })
    if (!allowed.test(pathname)) return new Response(null, { status: 404, headers: open })
    const file = Bun.file(join(ARCHIVE_DIR, normalize(pathname)))
    if (!(await file.exists())) return new Response(null, { status: 404, headers: open })
    // a Recording is named by its content and never changes; the rest may
    const lasting = pathname.startsWith('/recordings/')
    return new Response(file, {
      headers: {
        ...open,
        'Cache-Control': lasting ? 'public, max-age=31536000, immutable' : 'no-cache',
      },
    })
  },
})

console.log(`The Archive is open at http://${PUBLIC_HOST ?? '127.0.0.1'}:${ARCHIVE_PORT}/, from ${ARCHIVE_DIR}`)
