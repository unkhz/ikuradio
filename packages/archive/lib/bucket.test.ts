import { describe, expect, it } from 'bun:test'
import { paths, type Session } from './session.js'
import { bucketAt, BucketStore } from './bucket.js'

const bucket = 'https://hel1.your-objectstorage.com/ikuradio'
const song = (n: string, name?: string) =>
  ({ song: n, mood: ['rain'], mode: 'dorian', tempo: 80, choir: 'a woman', sound: 'oud', perspectives: [], thought: '', seconds: 300, name }) as unknown as Session

/** A bucket that keeps its things in memory, so a Song can be put and read again. */
const kept = (seed?: Record<string, string>) => {
  const things = new Map(Object.entries(seed ?? {}))
  const store = new BucketStore({ url: bucket, accessKeyId: 'k', secretAccessKey: 's' })
  ;(store as unknown as { client: unknown }).client = {
    write: async (key: string, body: string) => void things.set(key, body),
    exists: async (key: string) => things.has(key),
    file: (key: string) => ({
      json: async () => {
        const thing = things.get(key)
        if (thing === undefined) throw new Error(`nothing at ${key}`)
        return JSON.parse(thing)
      },
    }),
    list: async () => ({ contents: [], isTruncated: false }),
  }
  return store
}

describe('a bucket that wears names', () => {
  it('wears the slug a new Song was named', async () => {
    const store = kept()
    await store.putSession(song('1', 'Hollow death, by boredom'))
    expect(await store.names()).toEqual({ 'hollow-death-by-boredom': '1' })
  })

  it('wears nothing for a Song without a name', async () => {
    const store = kept()
    await store.putSession(song('2'))
    expect(await store.names()).toEqual({})
  })

  it('lets a renamed Song shed its old slug, and wear the new', async () => {
    const store = kept()
    await store.putSession(song('1', 'A long, slow thaw'))
    expect(await store.names()).toEqual({ 'a-long-slow-thaw': '1' })
    await store.putSession(song('1', 'The thaw, long and slow'))
    expect(await store.names()).toEqual({ 'the-thaw-long-and-slow': '1' })
  })

  it('never takes a slug another Song is wearing, and lets it back when that Song is renamed', async () => {
    const store = kept()
    await store.putSession(song('1', 'Hollow death'))
    await store.putSession(song('2', 'Hollow death'))
    expect(await store.names()).toEqual({ 'hollow-death': '1' })
    await store.putSession(song('1', 'Something else'))
    await store.putSession(song('2', 'Hollow death'))
    expect(await store.names()).toEqual({ 'something-else': '1', 'hollow-death': '2' })
  })
})

describe('a bucket that reads a Session', () => {
  it('reads a Session back, and gives nothing for a Song that is not there', async () => {
    const store = kept()
    await store.putSession(song('1', 'Hollow death'))
    expect((await store.session('1'))?.name).toBe('Hollow death')
    expect(await store.session('99')).toBeUndefined()
  })

  it('asks again, when a read fails and the Session is there', async () => {
    const things = new Map<string, string>()
    const store = new BucketStore({ url: bucket, accessKeyId: 'k', secretAccessKey: 's' })
    const sessionKey = paths.session('1')
    let fails = 2
    ;(store as unknown as { client: unknown }).client = {
      write: async (key: string, body: string) => void things.set(key, body),
      exists: async (key: string) => things.has(key),
      file: (key: string) => ({
        json: async () => {
          const thing = things.get(key)
          if (thing === undefined) throw new Error(`nothing at ${key}`)
          if (key === sessionKey && fails > 0) {
            fails--
            throw new Error('the bucket did not answer')
          }
          return JSON.parse(thing)
        },
      }),
      list: async () => ({ contents: [], isTruncated: false }),
    }
    await store.putSession(song('1', 'Hollow death'))
    expect((await store.session('1'))?.name).toBe('Hollow death')
    expect(fails).toBe(0)
  })
})

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
