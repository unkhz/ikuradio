// Chimera is the throat of the song: lungs, folds, tongue and lips, simulated
// as moving air. It does not sample anyone. Nobody's voice was taken to make
// it, so nobody's voice is worn out by singing forever.
//
// It is built from source, pinned to one revision, by `bun run throat`.

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PhonemeSyllable, Score, Singer, Syllables, VoiceLang } from 'melody'
import { sing } from './exec.js'
import { readAloud } from './reading.js'
import { hasSpecialWord, resolveLineSyllables } from './special.js'

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

/** Recordings being made now, by their file: one asked for twice at once is made once. */
const making = new Map<string, Promise<string>>()

/**
 * Makes a recording named by what it holds, once, however many ask for it
 * at the same moment: the same take in two sections that share a guide is
 * sung once. It is written under a name of its own and moved to its true
 * name only when it is whole, so nobody ever reads it half made.
 */
export async function makeOnce(file: string, make: (partial: string) => Promise<void>): Promise<string> {
  const going = making.get(file)
  if (going) return going
  if (await exists(file)) return file
  // asked for again while its existence was being looked for
  const raced = making.get(file)
  if (raced) return raced
  const made = (async () => {
    await mkdir(dirname(file), { recursive: true })
    // the same extension, so whatever writes it knows what to write
    const partial = file.replace(/(\.[a-z0-9]+)?$/i, (ext) => `.${randomUUID()}.partial${ext}`)
    try {
      await make(partial)
      await rename(partial, file)
    } catch (error) {
      await rm(partial, { force: true })
      throw error
    }
    return file
  })().finally(() => making.delete(file))
  making.set(file, made)
  return made
}

async function withScratch<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'ikuradio-'))
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
export async function countSyllables(line: string, lang: VoiceLang = 'en'): Promise<number> {
  const lyrics = lang === 'en' ? prepareLyrics(line) : line.trim()
  const key = lang === 'en' ? lyrics : `${lang}:${lyrics}`
  const known = counted.get(key)
  if (known !== undefined) {
    // asked again: it moves to the end, among the most recent
    counted.delete(key)
    counted.set(key, known)
    return known
  }

  // lines with special IPA words are counted directly from their resolved IPA syllables
  if (lang === 'en' && hasSpecialWord(lyrics)) {
    const resolved = await resolveLineSyllables(lyrics)
    if (resolved?.length) {
      counted.set(key, resolved.length)
      for (const old of counted.keys()) {
        if (counted.size <= countsRemembered) break
        counted.delete(old)
      }
      return resolved.length
    }
  }

  const count = await withScratch(async (dir) => {
    const input = join(dir, 'probe.json')
    await writeFile(
      input,
      JSON.stringify({ bpm: 60, lyrics, ...(lang !== 'en' ? { lang } : {}), notes: [[60, 1]] }),
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
  counted.set(key, count)
  // the oldest are let go
  for (const old of counted.keys()) {
    if (counted.size <= countsRemembered) break
    counted.delete(old)
  }
  return count
}

const syllablesRead = new Map<string, PhonemeSyllable[]>()

/**
 * Syllables as Chimera's built-in front end reads `line` in `lang` (`'en'`, `'tr'`, `'fi'`).
 * Cached per `(lang, line)` like `countSyllables`.
 */
export async function readSyllables(line: string, lang: VoiceLang = 'en'): Promise<PhonemeSyllable[]> {
  const lyrics = lang === 'en' ? prepareLyrics(line) : line.trim()
  if (!lyrics) return []
  const key = `${lang}:${lyrics}`
  const known = syllablesRead.get(key)
  if (known !== undefined) {
    syllablesRead.delete(key)
    syllablesRead.set(key, known)
    return known
  }
  const raw = await sing(chimera(), ['syllables', lyrics, lang])
  const parsed = JSON.parse(raw) as PhonemeSyllable[]
  syllablesRead.set(key, parsed)
  for (const old of syllablesRead.keys()) {
    if (syllablesRead.size <= countsRemembered) break
    syllablesRead.delete(old)
  }
  return parsed
}

/**
 * Groups Chimera's per-syllable output (`wordEnd`, `phraseEnd`, `nucleus.stress`)
 * into per-word `Syllables[]` for `fitToCount` and `timedLine`.
 */
export function syllablesToStressed(syllables: readonly PhonemeSyllable[]): Syllables[] {
  const words: Syllables[] = []
  let stresses: number[] = []
  for (const syl of syllables) {
    stresses.push(syl.nucleus.stress ?? 0)
    if (syl.wordEnd) {
      words.push({ stresses, ...(syl.phraseEnd ? { comma: true } : {}) })
      stresses = []
    }
  }
  if (stresses.length) words.push({ stresses })
  return words
}

/**
 * A score exactly as the throat is given it: if explicit IPA `syllables` are
 * present they are kept intact; non-English `lang` scores keep their lyrics as
 * written for Chimera's rule front end; otherwise English `lyrics` is read
 * aloud for CMUdict G2P. What the Studio sings, and what a Receiver is given
 * to sing the same.
 */
export function throatScore<T extends Score>(score: T): T {
  if (score.syllables) return { ...score }
  if (score.lang && score.lang !== 'en') return { ...score, lyrics: score.lyrics.trim() }
  return { ...score, lyrics: prepareLyrics(score.lyrics) }
}

/** A recording's name, without its folder or kind: the hash of the score that sang it. */
export const recordingName = (file: string) => file.replace(/^.*\//, '').replace(/\.[^.]*$/, '')

/**
 * Sings one line and keeps the recording. Returns the path the UI asks for.
 *
 * The same score in the same throat is the same recording, so a line that
 * returns is only ever sung once.
 */
export async function record(score: Score, singer: Singer): Promise<string> {
  const sung = throatScore(score)
  const name = createHash('sha256')
    .update(JSON.stringify({ singer, ...sung }))
    .digest('hex')
  const file = `${vocalsDir}/${name}.m4a`
  return makeOnce(file, (partial) => withScratch(async (dir) => {
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
      partial,
    ])
  }))
}
