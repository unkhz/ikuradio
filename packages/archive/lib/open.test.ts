import { describe, expect, it } from 'bun:test'
import { archiveAddress, Mirror, openArchive, publicArchive } from './open.js'
import { Store } from './store.js'
import { getEnv } from 'tools'

const env = (extra: Record<string, string>) => getEnv({ ...extra })

describe('openArchive', () => {
  it('keeps the folder alone when there is no bucket', () => {
    expect(openArchive(env({ ARCHIVE_DIR: '/tmp/a/' })).store).toBeInstanceOf(Store)
  })

  it('keeps the folder and the bucket alike when there is one', () => {
    const { store, where } = openArchive(
      env({
        ARCHIVE_DIR: '/tmp/a/',
        ARCHIVE_PUBLIC_URL: 'https://hel1.your-objectstorage.com/songthatneverends',
        ARCHIVE_ACCESS_KEY: 'k',
        ARCHIVE_SECRET_KEY: 's',
      }),
    )
    expect(store).toBeInstanceOf(Mirror)
    expect(where).toContain('songthatneverends')
  })
})

describe('archiveAddress', () => {
  const bucket = 'https://hel1.your-objectstorage.com/songthatneverends'
  it('reads what it is told to, then the bucket, then the folder', () => {
    expect(archiveAddress(env({ ARCHIVE_PUBLIC_URL: bucket }), 'http://x:1')).toBe('http://x:1/')
    expect(archiveAddress(env({ ARCHIVE_PUBLIC_URL: bucket }), undefined)).toBe(`${bucket}/`)
    expect(archiveAddress(env({}), undefined)).toBe('http://127.0.0.1:3001/')
  })

  it('sends Receivers to the bucket by its public address', () => {
    expect(publicArchive(env({ ARCHIVE_PUBLIC_URL: bucket }))).toBe(`${bucket}/`)
    expect(publicArchive(env({}))).toBeUndefined()
  })
})
