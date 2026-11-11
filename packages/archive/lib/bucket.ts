// The Archive, as a bucket: object storage in a cloud, reached over S3. The
// Studio puts Recordings and Sessions in with its keys; the Radio and every
// Receiver read them out again over plain HTTP, from the bucket's public
// address, and need no keys at all.
//
// A Session is listed in the index only after it and its Recordings are
// in, so nobody is ever sent to something that is not there yet. (Bun's S3
// client cannot set Cache-Control, so the bucket serves without it; the
// Radio and Receivers always ask afresh, and only a second visit misses the
// chance to keep a Recording, which never changes.)

import { S3Client } from 'bun'
import { basename } from 'node:path'
import { paths, type ArchiveIndex, type Session } from './session.js'
import type { ArchiveStore } from './store.js'

/** Where a bucket is, from its public, path-style address: https://<host>/<bucket>. */
export function bucketAt(url: string): { endpoint: string; bucket: string; region: string } {
  const { protocol, host, pathname } = new URL(url)
  const bucket = pathname.split('/').filter(Boolean)[0]
  if (!bucket) throw new Error(`no bucket in ${url}`)
  // Hetzner names its regions as the first part of the host: hel1, fsn1, nbg1
  const region = host.split('.')[0]
  return { endpoint: `${protocol}//${host}`, bucket, region }
}


export class BucketStore implements ArchiveStore {
  private readonly client: S3Client

  constructor({
    url,
    accessKeyId,
    secretAccessKey,
  }: {
    /** The bucket's public, path-style address. */
    url: string
    accessKeyId: string
    secretAccessKey: string
  }) {
    this.client = new S3Client({ ...bucketAt(url), accessKeyId, secretAccessKey })
  }

  private async put(key: string, body: Blob | string, type: string) {
    await this.client.write(key, body, { type, acl: 'public-read' })
  }

  async putRecording(file: string): Promise<string> {
    const id = basename(file)
    const key = paths.recording(id)
    if (await this.client.exists(key)) return id
    await this.put(key, Bun.file(file), 'audio/mp4')
    return id
  }

  async index(): Promise<ArchiveIndex> {
    try {
      return (await this.client.file(paths.index).json()) as ArchiveIndex
    } catch {
      return { songs: [] }
    }
  }

  async session(song: string): Promise<Session | undefined> {
    try {
      return (await this.client.file(paths.session(song)).json()) as Session
    } catch {
      return undefined
    }
  }

  async putSession(session: Session) {
    await this.put(paths.session(session.song), JSON.stringify(session), 'application/json')
    const { songs } = await this.index()
    const listed = [...new Set([...songs, session.song])].sort((a, b) =>
      BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0,
    )
    await this.put(paths.index, JSON.stringify({ songs: listed }), 'application/json')
  }

  async putDiary({ writing, books }: { writing: string; books: string[] }) {
    let shelved = 0
    for (const file of books) {
      const key = paths.diaryBook(basename(file))
      if (await this.client.exists(key)) continue
      await this.put(key, Bun.file(file), 'application/x-ndjson')
      shelved++
    }
    // a book just closed leaves nothing being written in, and so does the copy
    const open = Bun.file(writing)
    await this.put(paths.diary, (await open.exists()) ? open : '', 'application/x-ndjson')
    return shelved
  }

  /** Every key under `prefix`, a page at a time. */
  private async keys(prefix: string): Promise<string[]> {
    const keys: string[] = []
    let startAfter: string | undefined
    for (;;) {
      const page = await this.client.list({ prefix, maxKeys: 1000, ...(startAfter ? { startAfter } : {}) })
      const found = (page.contents ?? []).map(({ key }) => key)
      keys.push(...found)
      if (!page.isTruncated || found.length === 0) return keys
      startAfter = found.at(-1)
    }
  }

  async prune({ audible = 4, remembered = 2000 } = {}) {
    const { songs } = await this.index()
    const kept = songs.slice(-remembered)
    const gone = songs.slice(0, songs.length - kept.length)
    for (const song of gone) await this.client.delete(paths.session(song))
    if (gone.length) {
      await this.put(paths.index, JSON.stringify({ songs: kept }), 'application/json')
    }
    const needed = new Set<string>()
    for (const song of kept.slice(-audible)) {
      const session = await this.session(song)
      for (const { id } of [...(session?.recordings ?? []), ...(session?.guides ?? [])]) {
        needed.add(paths.recording(id))
      }
    }
    let deleted = 0
    for (const key of await this.keys('recordings/')) {
      if (needed.has(key)) continue
      await this.client.delete(key)
      deleted++
    }
    return deleted
  }
}
