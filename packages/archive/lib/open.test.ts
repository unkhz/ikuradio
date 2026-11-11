import { describe, expect, it } from 'bun:test'
import { getEnv } from 'tools'
import { archiveAddress, openArchive, publicArchive } from './open.js'
import { BucketStore } from './bucket.js'

const env = (extra: Record<string, string>) => getEnv({ ...extra })
const bucket = 'https://hel1.your-objectstorage.com/songthatneverends'

describe('openArchive', () => {
  it('opens the bucket, with its keys', () => {
    const { store, where } = openArchive(
      env({ ARCHIVE_PUBLIC_URL: bucket, ARCHIVE_ACCESS_KEY: 'k', ARCHIVE_SECRET_KEY: 's' }),
    )
    expect(store).toBeInstanceOf(BucketStore)
    expect(where).toBe(bucket)
  })

  it('refuses to make Songs nobody could hear', () => {
    expect(() => openArchive(env({ ARCHIVE_PUBLIC_URL: bucket }))).toThrow(/nowhere to put its Songs/)
  })
})

describe('archiveAddress', () => {
  it('reads what it is told to, or else the bucket', () => {
    expect(archiveAddress(env({ ARCHIVE_URL: 'https://x/a', ARCHIVE_PUBLIC_URL: bucket }))).toBe('https://x/a/')
    expect(archiveAddress(env({ ARCHIVE_PUBLIC_URL: bucket }))).toBe(`${bucket}/`)
    expect(() => archiveAddress(env({}))).toThrow(/no Archive to read/)
  })

  it('sends Receivers where they are told to go, or else where the Radio reads', () => {
    expect(publicArchive(env({ ARCHIVE_URL: `${bucket}/`, PUBLIC_ARCHIVE_URL: 'https://cdn/x' }))).toBe('https://cdn/x/')
    expect(publicArchive(env({ ARCHIVE_PUBLIC_URL: bucket }))).toBe(`${bucket}/`)
  })
})
