// Where the Archive is: the bucket, and nowhere else. There is no other copy
// of the song to practise on.

import { getEnv } from 'tools'
import { BucketStore } from './bucket.js'
import type { ArchiveStore } from './store.js'

const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`)

/** The Archive, to put Songs in: the bucket, with the keys only the Studio holds. */
export function openArchive(env = getEnv()): { store: ArchiveStore; where: string } {
  const { ARCHIVE_PUBLIC_URL, ARCHIVE_ACCESS_KEY, ARCHIVE_SECRET_KEY } = env
  if (!ARCHIVE_PUBLIC_URL || !ARCHIVE_ACCESS_KEY || !ARCHIVE_SECRET_KEY) {
    throw new Error(
      'the Studio has nowhere to put its Songs: ARCHIVE_PUBLIC_URL, ARCHIVE_ACCESS_KEY and ARCHIVE_SECRET_KEY are needed',
    )
  }
  return {
    store: new BucketStore({
      url: ARCHIVE_PUBLIC_URL,
      accessKeyId: ARCHIVE_ACCESS_KEY,
      secretAccessKey: ARCHIVE_SECRET_KEY,
    }),
    where: ARCHIVE_PUBLIC_URL,
  }
}

/** Where the Archive is read from, over HTTP: ARCHIVE_URL if it is given, or else the bucket's public address. */
export function archiveAddress(env = getEnv()): string {
  const url = env.ARCHIVE_URL ?? env.ARCHIVE_PUBLIC_URL
  if (!url) throw new Error('there is no Archive to read: ARCHIVE_URL or ARCHIVE_PUBLIC_URL is needed')
  return withSlash(url)
}

/** Where Receivers are sent for the Archive: PUBLIC_ARCHIVE_URL, or else wherever it is read from. */
export function publicArchive(env = getEnv()): string {
  return env.PUBLIC_ARCHIVE_URL ? withSlash(env.PUBLIC_ARCHIVE_URL) : archiveAddress(env)
}
