// Manual production queue for the Studio: lets a human or agent pin properties
// of the next Song(s) to be produced (arrangement, perspectives, mood, mode,
// tempo, sound, choir size, lead voice, breath, rate) for testing new
// components in production without altering autonomous weights.
//
// Stored as FIFO JSONL at `memory/queue.jsonl` (gitignored, untouched by
// deploys). Studio peeks when a new Song begins, increments `attempts` before
// waking the mind (dropping an entry after `maxAttempts` failures so a bad
// request can never stall the 24/7 radio), and consumes the entry only after
// `store.putSession` succeeds.

import { randomBytes } from 'node:crypto'
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { modes, type Breath, type ModeName, type Singer } from 'melody'
import type { Mood } from 'mood'
import { clash, readPerspectives, type PerspectiveRecord } from 'perspectives'
import { chosen } from './arrangement.js'

const validModes = new Set<string>(Object.keys(modes))
const validSingers = new Set<Singer>(['male', 'female', 'child'])
const validBreaths = new Set<Breath>(['soft', 'plain', 'pressed'])

/** How many failed production runs a queued entry may attempt before Studio drops it to protect the radio. */
export const maxQueueAttempts = 3

/** Properties a queued Song may pin; omitted fields fall back to normal autonomous Studio behavior. */
export type QueuedSongSpec = {
  /** Optional human/agent note describing why this Song was queued. */
  note?: string
  /** Pin the Arrangement by id (any active, makeable Arrangement, including weight 0). */
  arrangement?: string
  /** Pin exact Perspectives by slug (`[]` forces zero perspectives / clean baseline). */
  perspectives?: string[]
  /** Override Mood weather descriptions (1–5 phrases). */
  mood?: string[]
  /** Override musical mode (e.g. `dorian`, `phrygian`, `aeolian`). */
  mode?: ModeName
  /** Override Mood tempo in beats per minute (20–300). */
  tempo?: number
  /** Override MusicGen band sound description. */
  sound?: string
  /** Override choir size (1–4 voices). */
  choir?: number
  /** Override lead voice body (`male`, `female`, `child`). */
  lead?: Singer
  /** Override choir breath preset (`soft`, `plain`, `pressed`). */
  breath?: Breath
  /** Override syllable rate limit (syllables per second, 2–12). */
  rate?: number
}

/** One entry persisted in `memory/queue.jsonl`. */
export type QueuedSong = QueuedSongSpec & {
  id: string
  queued: string
  attempts?: number
}

const specKeys = new Set<string>([
  'note',
  'arrangement',
  'perspectives',
  'mood',
  'mode',
  'tempo',
  'sound',
  'choir',
  'lead',
  'breath',
  'rate',
])

const persistedKeys = new Set<string>([...specKeys, 'id', 'queued', 'attempts'])

/**
 * Validates the static shape and ranges of a queued Song spec (or persisted
 * entry when `allowMeta` is true). Returns a plain error string if anything is
 * invalid, or `undefined` when valid.
 */
export function refuseQueuedSpec(input: unknown, allowMeta = false): string | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'a queued Song must be a JSON object'
  const record = input as Record<string, unknown>
  const allowed = allowMeta ? persistedKeys : specKeys
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) return `unknown queued Song property "${key}"`
  }
  if (allowMeta) {
    if (record.id !== undefined && (typeof record.id !== 'string' || !record.id.trim())) return 'id must be a non-empty string'
    if (record.queued !== undefined && (typeof record.queued !== 'string' || !record.queued.trim())) return 'queued must be an ISO timestamp string'
    if (
      record.attempts !== undefined &&
      (typeof record.attempts !== 'number' || !Number.isInteger(record.attempts) || record.attempts < 0)
    ) {
      return 'attempts must be a non-negative integer'
    }
  }
  if (record.note !== undefined && (typeof record.note !== 'string' || !record.note.trim())) {
    return 'note must be a non-empty string'
  }
  if (record.arrangement !== undefined && (typeof record.arrangement !== 'string' || !record.arrangement.trim())) {
    return 'arrangement must be a non-empty string'
  }
  if (record.perspectives !== undefined) {
    if (!Array.isArray(record.perspectives) || !record.perspectives.every((s) => typeof s === 'string' && s.trim().length > 0)) {
      return 'perspectives must be an array of non-empty Perspective slugs (or [] for none)'
    }
  }
  if (record.mood !== undefined) {
    if (
      !Array.isArray(record.mood) ||
      record.mood.length < 1 ||
      record.mood.length > 5 ||
      !record.mood.every((s) => typeof s === 'string' && s.trim().length > 0)
    ) {
      return 'mood must be an array of 1 to 5 non-empty strings'
    }
  }
  if (record.mode !== undefined && (typeof record.mode !== 'string' || !validModes.has(record.mode))) {
    return `mode must be one of ${[...validModes].join(', ')}`
  }
  if (record.tempo !== undefined && (typeof record.tempo !== 'number' || !Number.isFinite(record.tempo) || record.tempo < 20 || record.tempo > 300)) {
    return 'tempo must be a number between 20 and 300 bpm'
  }
  if (record.sound !== undefined && (typeof record.sound !== 'string' || !record.sound.trim())) {
    return 'sound must be a non-empty string'
  }
  if (
    record.choir !== undefined &&
    (typeof record.choir !== 'number' || !Number.isInteger(record.choir) || record.choir < 1 || record.choir > 4)
  ) {
    return 'choir must be an integer between 1 and 4'
  }
  if (record.lead !== undefined && (typeof record.lead !== 'string' || !validSingers.has(record.lead as Singer))) {
    return 'lead must be one of male, female, child'
  }
  if (record.breath !== undefined && (typeof record.breath !== 'string' || !validBreaths.has(record.breath as Breath))) {
    return 'breath must be one of soft, plain, pressed'
  }
  if (record.rate !== undefined && (typeof record.rate !== 'number' || !Number.isFinite(record.rate) || record.rate < 2 || record.rate > 12)) {
    return 'rate must be a number between 2 and 12 syllables per second'
  }
  return undefined
}

export type ValidationDeps = {
  checkArrangement?: (id: string) => Promise<unknown>
  perspectives?: () => readonly PerspectiveRecord[]
  allowMeta?: boolean
}

/**
 * Full validation of a queued Song spec against both static bounds and live
 * Studio registries (active makeable Arrangement, known non-clashing Perspective slugs).
 */
export async function validateQueuedSong(spec: unknown, deps: ValidationDeps = {}): Promise<string | undefined> {
  const basic = refuseQueuedSpec(spec, deps.allowMeta)
  if (basic) return basic
  const one = spec as QueuedSongSpec
  if (one.arrangement !== undefined) {
    const check = deps.checkArrangement ?? chosen
    try {
      await check(one.arrangement)
    } catch (error) {
      return (error as Error).message
    }
  }
  if (one.perspectives?.length) {
    const records = deps.perspectives ? deps.perspectives() : readPerspectives()
    const bySlug = new Map(records.map((r) => [r.slug, r]))
    const picked: PerspectiveRecord[] = []
    for (const rawSlug of one.perspectives) {
      const slug = rawSlug.trim()
      const found = bySlug.get(slug)
      if (!found) return `unknown perspective "${slug}"`
      if (picked.some((prev) => prev.slug === slug)) return `duplicate perspective "${slug}"`
      const conflicting = picked.find((prev) => clash(prev, found))
      if (conflicting) return `perspectives "${conflicting.slug}" and "${found.slug}" clash on ${found.facet}`
      picked.push(found)
    }
  }
  return undefined
}

/** Normalizes a validated spec by stripping empty/undefined fields. */
export function normalizeSpec(spec: QueuedSongSpec): QueuedSongSpec {
  const out: QueuedSongSpec = {}
  if (spec.note !== undefined) out.note = spec.note.trim()
  if (spec.arrangement !== undefined) out.arrangement = spec.arrangement.trim()
  if (spec.perspectives !== undefined) out.perspectives = spec.perspectives.map((s) => s.trim())
  if (spec.mood !== undefined) out.mood = spec.mood.map((s) => s.trim())
  if (spec.mode !== undefined) out.mode = spec.mode
  if (spec.tempo !== undefined) out.tempo = Math.round(spec.tempo)
  if (spec.sound !== undefined) out.sound = spec.sound.trim()
  if (spec.choir !== undefined) out.choir = spec.choir
  if (spec.lead !== undefined) out.lead = spec.lead
  if (spec.breath !== undefined) out.breath = spec.breath
  if (spec.rate !== undefined) out.rate = spec.rate
  return out
}

/** Layers explicit `QueuedSongSpec` character overrides (`mode`, `tempo`, `sound`, `lead`, `breath`, `mood`) onto a Mood. */
export function applyQueuedMood(base: Mood, queued: QueuedSongSpec): Mood {
  const descriptions = queued.mood?.length ? [...queued.mood] : base.descriptions
  const existingVoice = base.character.voice
  const voice =
    queued.lead || queued.breath
      ? {
          lead: queued.lead ?? existingVoice?.lead ?? 'female',
          breath: queued.breath ?? existingVoice?.breath ?? 'plain',
        }
      : existingVoice
  return {
    ...base,
    descriptions,
    character: {
      ...base.character,
      ...(queued.mode !== undefined ? { mode: queued.mode } : {}),
      ...(queued.tempo !== undefined ? { tempo: queued.tempo } : {}),
      ...(queued.sound !== undefined ? { sound: queued.sound } : {}),
      ...(voice ? { voice } : {}),
    },
  }
}

/** Formats a compact one-line summary of a queued Song entry for logs and CLI output. */
export function describeQueued(entry: QueuedSong): string {
  const bits: string[] = []
  if (entry.arrangement) bits.push(`arrangement=${entry.arrangement}`)
  if (entry.mode) bits.push(`mode=${entry.mode}`)
  if (entry.tempo !== undefined) bits.push(`tempo=${entry.tempo}bpm`)
  if (entry.mood?.length) bits.push(`mood="${entry.mood.join(' + ')}"`)
  if (entry.sound) bits.push(`sound="${entry.sound}"`)
  if (entry.perspectives !== undefined) {
    bits.push(`perspectives=${entry.perspectives.length ? entry.perspectives.join(',') : 'none'}`)
  }
  if (entry.choir !== undefined) bits.push(`choir=${entry.choir}`)
  if (entry.lead) bits.push(`lead=${entry.lead}`)
  if (entry.breath) bits.push(`breath=${entry.breath}`)
  if (entry.rate !== undefined) bits.push(`rate=${entry.rate}`)
  if (entry.note) bits.push(`note="${entry.note}"`)
  if (entry.attempts) bits.push(`attempts=${entry.attempts}`)
  return bits.length ? bits.join(' ') : '(all autonomous defaults)'
}

function parseEntry(line: string): QueuedSong | undefined {
  try {
    const raw = JSON.parse(line) as Partial<QueuedSong>
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return undefined
    return raw as QueuedSong
  } catch {
    return undefined
  }
}

/**
 * FIFO production queue backed by `memory/queue.jsonl`. All mutations write to
 * a temp file and atomically rename into place so concurrent readers never see
 * half-written JSON.
 */
export class SongQueue {
  constructor(readonly file = 'memory/queue.jsonl') {}

  async list(): Promise<QueuedSong[]> {
    let text: string
    try {
      text = await readFile(this.file, 'utf8')
    } catch {
      return []
    }
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseEntry)
      .filter((entry): entry is QueuedSong => entry !== undefined)
  }

  async peek(): Promise<QueuedSong | undefined> {
    return (await this.list())[0]
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await mkdir(dirname(this.file), { recursive: true })
    const lockPath = `${this.file}.lock`
    const deadline = Date.now() + 5000
    let acquired = false
    while (!acquired) {
      try {
        const handle = await open(lockPath, 'wx')
        await handle.writeFile(`${process.pid}\n`)
        await handle.close()
        acquired = true
      } catch (error) {
        if ((error as { code?: string }).code !== 'EEXIST') throw error
        const info = await stat(lockPath).catch(() => undefined)
        if (info && Date.now() - info.mtimeMs > 5000) {
          await unlink(lockPath).catch(() => {})
          continue
        }
        if (Date.now() > deadline) throw new Error(`timed out waiting for queue lock ${lockPath}`)
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    }
    try {
      return await fn()
    } finally {
      await unlink(lockPath).catch(() => {})
    }
  }

  private async save(entries: readonly QueuedSong[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
    const body = entries.map((entry) => `${JSON.stringify(entry)}\n`).join('')
    await writeFile(tmp, body, 'utf8')
    await rename(tmp, this.file)
  }

  async push(spec: QueuedSongSpec): Promise<QueuedSong> {
    return this.withLock(async () => {
      const clean = normalizeSpec(spec)
      const entry: QueuedSong = {
        id: randomBytes(4).toString('hex'),
        ...clean,
        queued: new Date().toISOString(),
      }
      const entries = await this.list()
      entries.push(entry)
      await this.save(entries)
      return entry
    })
  }

  /** Increments the attempt counter on `id` and returns the updated count (or 0 if missing). */
  async markAttempt(id: string): Promise<number> {
    return this.withLock(async () => {
      const entries = await this.list()
      const target = entries.find((entry) => entry.id === id)
      if (!target) return 0
      const prev = typeof target.attempts === 'number' && Number.isFinite(target.attempts) ? target.attempts : 0
      target.attempts = prev + 1
      await this.save(entries)
      return target.attempts
    })
  }

  /** Removes the entry with `id` (returns true if found and removed). */
  async consume(id: string): Promise<boolean> {
    return this.withLock(async () => {
      const entries = await this.list()
      const next = entries.filter((entry) => entry.id !== id)
      if (next.length === entries.length) return false
      await this.save(next)
      return true
    })
  }

  /** Removes and returns the first queued entry, or undefined if empty. */
  async pop(): Promise<QueuedSong | undefined> {
    return this.withLock(async () => {
      const entries = await this.list()
      const first = entries.shift()
      if (!first) return undefined
      await this.save(entries)
      return first
    })
  }

  /** Clears every entry from the queue and returns how many were removed. */
  async clear(): Promise<number> {
    return this.withLock(async () => {
      const entries = await this.list()
      if (entries.length === 0) return 0
      await this.save([])
      return entries.length
    })
  }

  /**
   * Returns the first valid, non-exhausted entry at the head of the queue.
   * Any invalid entry or entry that already reached `maxAttempts` is logged
   * via `warn` and removed so a bad manual item can never stall the radio.
   */
  async nextReady(
    deps: ValidationDeps & { maxAttempts?: number; warn?: (message: string) => void } = {},
  ): Promise<QueuedSong | undefined> {
    const limit = deps.maxAttempts ?? maxQueueAttempts
    const warn = deps.warn ?? ((msg: string) => console.warn(msg))
    while (true) {
      const head = await this.peek()
      if (!head) return undefined
      const attempts = typeof head.attempts === 'number' && Number.isFinite(head.attempts) ? head.attempts : 0
      if (attempts >= limit) {
        warn(`dropping queued Song ${head.id} after ${attempts} failed attempts (${describeQueued(head)})`)
        await this.consume(head.id)
        continue
      }
      const problem = await validateQueuedSong(head, { ...deps, allowMeta: true })
      if (problem) {
        warn(`dropping invalid queued Song ${head.id}: ${problem}`)
        await this.consume(head.id)
        continue
      }
      return head
    }
  }
}
