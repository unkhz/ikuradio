// Helper CLI to encode or decode `/p/<slug>` playlist URLs.
//
// Usage:
//   bun run playlist 2177 2178 2179 2180
//   bun run playlist --decode <slug-or-url>

import { decodePlaylist, encodePlaylist, playlistPath } from './playlist.js'

const args = process.argv.slice(2)
if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
  console.log('Usage:\n  bun run playlist <songId> [songId ...]\n  bun run playlist --decode <slug-or-url>')
  process.exit(0)
}

if (args[0] === '--decode' || args[0] === '-d') {
  const raw = (args[1] ?? '').trim().replace(/[?#].*$/, '').replace(/^.*\/p\//, '').replace(/\.json$/, '')
  const ids = decodePlaylist(raw)
  if (!ids) {
    console.error(`Invalid playlist slug: "${args[1] ?? ''}"`)
    process.exit(1)
  }
  console.log(ids.join(' '))
  process.exit(0)
}

try {
  const slug = encodePlaylist(args)
  const path = playlistPath(args)
  console.log(path)
  console.log(`https://ikurad.io${path}`)
  console.log(`slug: ${slug}`)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
