// On air, on one machine: the Archive's door, the Radio, and a Studio called
// in whenever too few Songs are waiting ahead of the one being played.
//
//   bun run on-air
//
// In production these are three separate lives on separate machines, and
// the Archive is cloud storage. Here they share xitra, and take turns.

import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { getEnv } from 'tools'
import { archiveAddress, paths, type ArchiveIndex } from 'archive'

const { SERVER_PORT, SONGS_AHEAD } = getEnv()
const at = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const lives: ChildProcess[] = []
function live(name: string, script: string, cwd: string) {
  const child = spawn('bun', [script], { cwd, stdio: 'inherit' })
  child.on('exit', (code) => {
    // a Studio ends when its Song is made; anything else stopping is news
    if (!resting && (code !== 0 || name !== 'Studio')) {
      console.warn(`the ${name} stopped (${code})`)
    }
  })
  lives.push(child)
  return child
}

let resting = false
function rest(signal: NodeJS.Signals) {
  resting = true
  for (const child of lives) child.kill(signal)
  setTimeout(() => process.exit(0), 500)
}
process.on('SIGTERM', () => rest('SIGTERM'))
process.on('SIGINT', () => rest('SIGINT'))

live('Archive', at('../archive/serve.ts'), at('../archive/'))
live('Radio', at('./index.ts'), at('./'))

async function read<T>(url: string): Promise<T | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return response.ok ? ((await response.json()) as T) : undefined
  } catch {
    return undefined
  }
}

/** How many finished Songs are waiting in the Archive after the one being played. */
async function waiting(): Promise<number | undefined> {
  const index = await read<ArchiveIndex>(new URL(paths.index, archiveAddress()).href)
  const tactus = await read<{ playing?: { song: string }; next?: { song: string } }>(
    `http://127.0.0.1:${SERVER_PORT}/tactus`,
  )
  if (!tactus) return undefined
  const songs = index?.songs ?? []
  const playing = tactus.playing?.song
  return songs.filter((s) => playing === undefined || BigInt(s) > BigInt(playing)).length
}

let studio: ChildProcess | undefined
async function keep() {
  if (resting || studio) return
  const ahead = await waiting()
  if (ahead === undefined || ahead >= SONGS_AHEAD) return
  console.log(`${ahead} Songs waiting, ${SONGS_AHEAD} wanted: the Studio is called in`)
  studio = live('Studio', at('../studio/index.ts'), at('../studio/'))
  studio.on('exit', () => {
    lives.splice(lives.indexOf(studio!), 1)
    studio = undefined
    keep()
  })
}

// a moment for the Archive and the Radio to open their doors
setTimeout(keep, 3000)
setInterval(keep, 30_000)
