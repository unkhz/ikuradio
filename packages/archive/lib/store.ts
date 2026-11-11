// The Archive, as a folder: a directory on the machine, and a small file
// server in front of it. In production the Archive is a bucket instead
// (bucket.ts); both keep the same things the same way. The Studio puts
// things in; Receivers and the Radio only ever read, over HTTP.

import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { paths, type ArchiveIndex, type Session } from './session.js'

async function exists(file: string) {
  try {
    return (await stat(file)).isFile()
  } catch {
    return false
  }
}

/** Writes a file whole, or not at all: a Receiver never reads half a Session. */
async function writeWhole(file: string, content: string) {
  await mkdir(dirname(file), { recursive: true })
  const unfinished = `${file}.${process.pid}.unfinished`
  await writeFile(unfinished, content)
  await rename(unfinished, file)
}

/** What the Studio needs of an Archive, a folder or a bucket. */
export interface ArchiveStore {
  /** Puts a Recording in, named by its file's name, its content as a hash; returns its id. */
  putRecording(file: string): Promise<string>
  index(): Promise<ArchiveIndex>
  session(song: string): Promise<Session | undefined>
  /** Puts a Session in, after its Recordings, and only then lists it. */
  putSession(session: Session): Promise<void>
  /** Lets go of what nobody will play again; returns how many Recordings went. */
  prune(options?: { audible?: number; remembered?: number }): Promise<number>
}

export class Store implements ArchiveStore {
  constructor(readonly dir: string) {}

  /**
   * Puts a Recording in the Archive, named by its file's name, which is
   * already its content as a hash. A Recording already there is not put
   * again. Returns its id.
   */
  async putRecording(file: string): Promise<string> {
    const id = basename(file)
    const to = join(this.dir, paths.recording(id))
    if (await exists(to)) return id
    await mkdir(dirname(to), { recursive: true })
    const unfinished = `${to}.${process.pid}.unfinished`
    await copyFile(file, unfinished)
    await rename(unfinished, to)
    return id
  }

  async index(): Promise<ArchiveIndex> {
    try {
      return JSON.parse(await readFile(join(this.dir, paths.index), 'utf8'))
    } catch {
      return { songs: [] }
    }
  }

  async session(song: string): Promise<Session | undefined> {
    try {
      return JSON.parse(await readFile(join(this.dir, paths.session(song)), 'utf8'))
    } catch {
      return undefined
    }
  }

  /** Puts a Session in the Archive, after its Recordings, and only then lists it. */
  async putSession(session: Session) {
    await writeWhole(join(this.dir, paths.session(session.song)), JSON.stringify(session))
    const { songs } = await this.index()
    const listed = [...new Set([...songs, session.song])].sort((a, b) =>
      BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0,
    )
    await writeWhole(join(this.dir, paths.index), JSON.stringify({ songs: listed }))
  }

  /**
   * Lets go of what nobody will play again. The newest `audible` Songs keep
   * their Recordings; every other Recording is deleted. Sessions are small
   * and keep their words for looking back: the newest `remembered` are kept.
   */
  async prune({ audible = 4, remembered = 2000 } = {}) {
    const { songs } = await this.index()
    const kept = songs.slice(-remembered)
    const gone = songs.slice(0, songs.length - kept.length)
    for (const song of gone) await rm(join(this.dir, paths.session(song)), { force: true })
    if (gone.length) await writeWhole(join(this.dir, paths.index), JSON.stringify({ songs: kept }))

    const needed = new Set<string>()
    for (const song of kept.slice(-audible)) {
      const session = await this.session(song)
      for (const { id } of [...(session?.recordings ?? []), ...(session?.guides ?? [])]) {
        needed.add(id)
      }
    }
    const shelf = join(this.dir, 'recordings')
    let deleted = 0
    for (const id of await readdir(shelf).catch(() => [] as string[])) {
      if (needed.has(id) || id.endsWith('.unfinished')) continue
      await rm(join(shelf, id), { force: true })
      deleted++
    }
    return deleted
  }
}
