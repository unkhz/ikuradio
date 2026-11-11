// Chimera is the throat of the song: lungs, folds, tongue and lips, simulated
// as moving air. It does not sample anyone. Nobody's voice was taken to make
// it, so nobody's voice is worn out by singing forever.
//
// It is built from source, pinned to one revision, by `bun run throat`.

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Score, Singer } from 'melody'
import { sing } from './exec.js'
import { readAloud } from './reading.js'

function chimera() {
  return (
    process.env.CHIMERA_BIN ??
    fileURLToPath(
      new URL('../.chimera/target/release/chimera', import.meta.url),
    )
  )
}

/** Where recorded lines are kept, relative to the process. The UI fetches them from here. */
export const vocalsDir = 'audio/vocals'

/**
 * Lyrics as the throat wants them. Whatever it cannot read is read aloud
 * first, in words. A hyphen between two words would be sung as one word
 * drawn out over two notes, so the words are let apart.
 */
export function prepareLyrics(line: string): string {
  return readAloud(line)
    .replace(/(\w)-(\w)/g, '$1 $2')
    .trim()
}

async function exists(file: string) {
  try {
    return (await stat(file)).isFile()
  } catch {
    return false
  }
}

async function withScratch<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'song-that-never-ends-'))
  try {
    return await work(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * Lines already counted, the most recent last. A song that lives for ever
 * cannot remember every line it has ever counted, so it remembers enough
 * for a few iterations, which is all it ever asks about twice.
 */
const counted = new Map<string, number>()
export const countsRemembered = 512
/** How many lines are remembered now. */
export const countsHeld = () => counted.size

/** Reads how many syllables the throat hears in a refusal like "12 syllables for 1 notes: …". */
export function parseRefusal(message: string): number | undefined {
  const match = /^(\d+) syllables for \d+ notes:/m.exec(message)
  return match ? Number(match[1]) : undefined
}

/**
 * How many notes the line needs, counted by the voice that will sing it.
 *
 * The throat is offered a single note. If the line is longer, it refuses and
 * says how many syllables it heard, which is the answer.
 */
export async function countSyllables(line: string): Promise<number> {
  const lyrics = prepareLyrics(line)
  const known = counted.get(lyrics)
  if (known !== undefined) {
    // asked again: it moves to the end, among the most recent
    counted.delete(lyrics)
    counted.set(lyrics, known)
    return known
  }

  const count = await withScratch(async (dir) => {
    const input = join(dir, 'probe.json')
    await writeFile(
      input,
      JSON.stringify({ bpm: 60, lyrics, notes: [[60, 1]] }),
    )
    try {
      await sing(chimera(), ['render', 'notes', input, join(dir, 'probe')])
      return 1
    } catch (error) {
      const syllables = parseRefusal(String((error as Error).message))
      if (syllables === undefined) throw error
      return syllables
    }
  })
  counted.set(lyrics, count)
  // the oldest are let go
  for (const old of counted.keys()) {
    if (counted.size <= countsRemembered) break
    counted.delete(old)
  }
  return count
}

/**
 * Sings one line and keeps the recording. Returns the path the UI asks for.
 *
 * The same score in the same throat is the same recording, so a line that
 * returns is only ever sung once.
 */
export async function record(score: Score, singer: Singer): Promise<string> {
  const sung = { ...score, lyrics: prepareLyrics(score.lyrics) }
  const name = createHash('sha256')
    .update(JSON.stringify({ singer, ...sung }))
    .digest('hex')
  const file = `${vocalsDir}/${name}.m4a`
  if (await exists(file)) return file

  await mkdir(vocalsDir, { recursive: true })
  await withScratch(async (dir) => {
    const input = join(dir, 'score.json')
    await writeFile(input, JSON.stringify(sung))
    await sing(chimera(), ['render', 'notes', input, join(dir, 'line'), singer])
    await sing('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      join(dir, 'line.wav'),
      '-c:a',
      'aac',
      '-b:a',
      '64k',
      file,
    ])
  })
  return file
}
