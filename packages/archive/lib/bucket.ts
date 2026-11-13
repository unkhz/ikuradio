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

  /** Asks again, a little later each time, before giving up: the bucket is far away. */
  private async patiently<T>(what: string, work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await work()
      } catch (error) {
        if (attempt >= 6) throw error
        console.warn(`the Archive did not answer (${what}), asking again: ${String(error).slice(0, 160)}`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
      }
    }
  }

  private async put(key: string, body: Blob | string, type: string) {
    await this.patiently(`put ${key}`, () => this.client.write(key, body, { type, acl: 'public-read' }))
  }

  private exists(key: string) {
    return this.patiently(`look for ${key}`, () => this.client.exists(key))
  }

  async hasSession(song: string): Promise<boolean> {
    return this.exists(paths.session(song))
  }

  async putRecording(file: string): Promise<string> {
    const id = basename(file)
    const key = paths.recording(id)
    if (await this.exists(key)) return id
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
      if (await this.exists(key)) continue
      await this.put(key, Bun.file(file), 'application/x-ndjson')
      shelved++
    }
    // a book just closed leaves nothing being written in, and so does the copy
    const open = Bun.file(writing)
    await this.put(paths.diary, (await open.exists()) ? open : '', 'application/x-ndjson')
    return shelved
  }

  async putThoughts(file: string) {
    const month = basename(file, '.jsonl')
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`not a month of thoughts: ${file}`)
    await this.put(paths.thoughts(month), Bun.file(file), 'application/x-ndjson')
  }
}
