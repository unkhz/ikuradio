import { describe, expect, it } from 'bun:test'
import { bucketAt } from './bucket.js'

describe('bucketAt', () => {
  it('finds the endpoint, the bucket and the region in a public address', () => {
    expect(bucketAt('https://hel1.your-objectstorage.com/ikuradio')).toEqual({
      endpoint: 'https://hel1.your-objectstorage.com',
      bucket: 'ikuradio',
      region: 'hel1',
    })
    expect(bucketAt('https://hel1.your-objectstorage.com/ikuradio/').bucket).toBe('ikuradio')
  })

  it('refuses an address with no bucket in it', () => {
    expect(() => bucketAt('https://hel1.your-objectstorage.com/')).toThrow()
  })
})
