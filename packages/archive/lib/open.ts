// Which Archive the Studio writes to: always the folder, and the bucket
// too if its address and keys are given. The folder is the dev box's own
// Archive, which a Radio on the same machine plays from; the bucket is the
// one the world listens to.

import { getEnv } from 'tools'
import { BucketStore } from './bucket.js'
import { Store, type ArchiveStore } from './store.js'

/** Several Archives kept alike: everything put in one is put in all, and read from the first. */
export class Mirror implements ArchiveStore {
  constructor(private readonly stores: readonly ArchiveStore[]) {}
  async putRecording(file: string) {
    const [id] = await Promise.all(this.stores.map((store) => store.putRecording(file)))
    return id
  }
  index() {
    return this.stores[0].index()
  }
  session(song: string) {
    return this.stores[0].session(song)
  }
  async putSession(session: Parameters<ArchiveStore['putSession']>[0]) {
    await Promise.all(this.stores.map((store) => store.putSession(session)))
  }
  async prune(options?: { audible?: number; remembered?: number }) {
    const [deleted] = await Promise.all(this.stores.map((store) => store.prune(options)))
    return deleted
  }
}

export function openArchive(env = getEnv()): { store: ArchiveStore; where: string } {
  const { ARCHIVE_PUBLIC_URL, ARCHIVE_ACCESS_KEY, ARCHIVE_SECRET_KEY, ARCHIVE_DIR } = env
  const folder = new Store(ARCHIVE_DIR)
  if (ARCHIVE_PUBLIC_URL && ARCHIVE_ACCESS_KEY && ARCHIVE_SECRET_KEY) {
    const bucket = new BucketStore({
      url: ARCHIVE_PUBLIC_URL,
      accessKeyId: ARCHIVE_ACCESS_KEY,
      secretAccessKey: ARCHIVE_SECRET_KEY,
    })
    return { store: new Mirror([folder, bucket]), where: `${ARCHIVE_DIR} and ${ARCHIVE_PUBLIC_URL}` }
  }
  return { store: folder, where: ARCHIVE_DIR }
}

const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`)

/**
 * Where the Archive is read from, over HTTP: ARCHIVE_URL if it is given;
 * else the bucket's public address, if there is a bucket; else the folder's
 * file server.
 */
export function archiveAddress(env = getEnv(), given = process.env.ARCHIVE_URL): string {
  if (given) return withSlash(given)
  if (env.ARCHIVE_PUBLIC_URL) return withSlash(env.ARCHIVE_PUBLIC_URL)
  return withSlash(env.ARCHIVE_URL)
}

/** Where Receivers are sent for the Archive, if it is a bucket: its public address. */
export function publicArchive(env = getEnv()): string | undefined {
  const url = env.PUBLIC_ARCHIVE_URL ?? env.ARCHIVE_PUBLIC_URL
  return url ? withSlash(url) : undefined
}
