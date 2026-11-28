// Static server for throat.ikurad.io: serves Chimera's web app built from the
// exact revision pinned in packages/vocals/lib/throat.ts, so any vocal-tract
// or language-front-end issue can be inspected interactively against the live
// engine.

import { statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.gz': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.sh': 'text/x-shellscript; charset=utf-8',
}

function cacheFor(pathname: string): string {
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable'
  if (pathname.startsWith('/fonts/') || pathname.startsWith('/data/')) return 'public, max-age=86400'
  return 'no-cache'
}

export function createHandler(distDir: string) {
  const root = resolve(distDir)

  return function handle(request: Request): Response {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405 })
    }
    const url = new URL(request.url)
    const pathname = url.pathname

    if (pathname === '/healthz') {
      return new Response('ok\n', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }

    if (pathname === '/plugin') {
      return Response.redirect(new URL('/plugin/', url).href, 301)
    }

    let decoded: string
    try {
      decoded = decodeURIComponent(pathname)
    } catch {
      return new Response(null, { status: 400 })
    }

    const rel = decoded.endsWith('/') ? `${decoded}index.html` : decoded
    const candidate = resolve(root, `.${rel}`)
    if (candidate !== root && !candidate.startsWith(`${root}/`)) {
      return new Response(null, { status: 404 })
    }

    let target = candidate
    try {
      const info = statSync(target)
      if (info.isDirectory()) {
        target = join(target, 'index.html')
        statSync(target)
      }
    } catch {
      return new Response(null, { status: 404 })
    }

    const ext = target.endsWith('.txt.gz') ? '.gz' : extname(target)
    const type = MIME[ext] ?? 'application/octet-stream'
    return new Response(request.method === 'HEAD' ? null : Bun.file(target), {
      headers: {
        'Content-Type': type,
        'Cache-Control': cacheFor(decoded),
      },
    })
  }
}

if (import.meta.main) {
  const port = Number(process.env.SERVER_PORT || 3000)
  const dist = process.env.DIST_DIR || '/srv/dist'
  const fetch = createHandler(dist)
  const server = Bun.serve({ port, fetch })
  console.log(`The Throat is live on port ${server.port}, serving ${resolve(dist)}`)

  const rest = (signal: string) => {
    console.log(`The Throat rests (${signal}).`)
    server.stop(true)
    process.exit(0)
  }
  process.on('SIGTERM', () => rest('SIGTERM'))
  process.on('SIGINT', () => rest('SIGINT'))
}
