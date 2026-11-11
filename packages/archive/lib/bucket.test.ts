import { describe, expect, it } from 'bun:test'
import { bucketAt } from './bucket.js'

describe('bucketAt', () => {
  it('finds the endpoint, the bucket and the region in a public address', () => {
    expect(bucketAt('https://hel1.your-objectstorage.com/songthatneverends')).toEqual({
      endpoint: 'https://hel1.your-objectstorage.com',
      bucket: 'songthatneverends',
      region: 'hel1',
    })
    expect(bucketAt('https://hel1.your-objectstorage.com/songthatneverends/').bucket).toBe('songthatneverends')
  })

  it('refuses an address with no bucket in it', () => {
    expect(() => bucketAt('https://hel1.your-objectstorage.com/')).toThrow()
  })
})
