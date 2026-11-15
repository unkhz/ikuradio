import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFile, rm } from 'node:fs/promises'
import { RequestLog } from './log.js'

const file = () => `/tmp/radio-log-test-${process.pid}-${Math.random().toString(36).slice(2)}.db`
const gone = (path: string) => Promise.all(['', '-wal', '-shm'].map((end) => rm(`${path}${end}`, { force: true })))

const visit = (path: string, headers: Record<string, string>, status = 200, at = Date.parse('2026-11-15T12:00:30Z')) => ({
  at,
  method: 'GET',
  url: new URL(`https://ikurad.io${path}`),
  status,
  ms: 3.14159,
  headers: new Headers(headers),
})

const visitor = {
  'cf-connecting-ip': '203.0.113.7',
  'x-real-ip': '198.51.100.1',
  'x-forwarded-for': '203.0.113.7, 198.51.100.1',
  'cf-ipcountry': 'FI',
  'cf-ipcity': 'Helsinki',
  'cf-iplatitude': '60.16952',
  'cf-iplongitude': '24.93545',
  'cf-postal-code': '00100',
  'cf-metro-code': '7777',
  'cf-ray': '8c1-HEL',
  'user-agent': 'a lost listener',
  'accept-language': 'fi, en',
  'sec-ch-ua': '"Chromium";v="142"',
  'sec-ch-ua-mobile': '?1',
  referer: 'https://example.org/',
  host: 'ikurad.io',
}

/** Everything the database holds, every table, as text. */
const everything = (log: RequestLog) =>
  JSON.stringify(
    (log.db.query("select name from sqlite_master where type = 'table'").all() as { name: string }[]).map(({ name }) => log.db.query(`select * from ${name}`).all()),
  )

describe('the Radio’s log', () => {
  it('knows where a request came from no finer than its city', async () => {
    const path = file()
    const log = new RequestLog(path, { flushEvery: 0 })
    log.record(visit('/s/7', visitor))
    log.record(visit('/tactus', visitor))
    log.flush()
    const columns = (log.db.query("select name from pragma_table_info('requests')").all() as { name: string }[]).map(({ name }) => name)
    for (const fine of ['latitude', 'longitude', 'postal_code', 'metro_code']) expect(columns).not.toContain(fine)
    expect(columns).toEqual(expect.arrayContaining(['country', 'continent', 'region', 'region_code', 'city', 'timezone']))
    const held = JSON.stringify([log.db.query('select * from requests').all(), log.db.query('select * from tactus').all()])
    for (const value of ['60.16952', '24.93545', '00100', '7777']) expect(held).not.toContain(value)
    log.close()
    const bytes = await readFile(path)
    for (const value of ['60.16952', '24.93545', '00100', '7777']) expect(bytes.includes(Buffer.from(value))).toBe(false)
    await gone(path)
  })

  it('begins again a database of the shape that kept finer places, leaving none of them in the file', async () => {
    const path = file()
    const old = new Database(path, { create: true })
    old.exec(`create table requests (id integer primary key, at integer, path text, latitude text, longitude text, postal_code text);
      insert into requests (at, path, latitude, longitude, postal_code) values (1, '/', '61.49911', '23.78712', '33100');
      create table tactus (minute integer, country text, city text, count integer);
      pragma user_version = 1;`)
    old.close()
    const log = new RequestLog(path, { flushEvery: 0 })
    expect(log.db.query('select count(*) as n from requests').get()).toEqual({ n: 0 })
    log.close()
    const bytes = await readFile(path)
    for (const value of ['61.49911', '23.78712', '33100']) expect(bytes.includes(Buffer.from(value))).toBe(false)
    await gone(path)
  })

  it('writes a request down with what it says of where it came from and what asked', async () => {
    const path = file()
    const log = new RequestLog(path, { flushEvery: 0 })
    log.record(visit('/s/42', visitor))
    log.record(visit('/nothing', visitor, 404))
    log.flush()
    const rows = log.db.query('select * from requests order by id').all() as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ method: 'GET', path: '/s/42', status: 200, ms: 3.1, country: 'FI', city: 'Helsinki', ray: '8c1-HEL', user_agent: 'a lost listener', host: 'ikurad.io', referer: 'https://example.org/', accept_language: 'fi, en' })
    expect(rows[1]).toMatchObject({ path: '/nothing', status: 404 })
    expect(JSON.parse(rows[0]!.client_hints as string)).toEqual({ 'sec-ch-ua': '"Chromium";v="142"', 'sec-ch-ua-mobile': '?1' })
    log.close()
    await gone(path)
  })

  it('keeps no address, in any form, anywhere in the database', async () => {
    const path = file()
    const log = new RequestLog(path, { flushEvery: 0 })
    log.record(visit('/', visitor))
    log.record(visit('/tactus', visitor))
    log.flush()
    const held = everything(log)
    expect(held).not.toContain('203.0.113')
    expect(held).not.toContain('198.51.100')
    const columns = (log.db.query("select name from pragma_table_info('requests')").all() as { name: string }[]).map(({ name }) => name)
    for (const forbidden of ['visitor', 'edge', 'forwarded_for', 'ip']) expect(columns).not.toContain(forbidden)
    log.close()
    // nor in the file itself
    expect((await readFile(path)).includes(Buffer.from('203.0.113'))).toBe(false)
    await gone(path)
  })

  it('counts the receivers’ heartbeat per minute by country and city, not one row each', async () => {
    const path = file()
    const log = new RequestLog(path, { flushEvery: 0 })
    const minute = Date.parse('2026-11-15T12:00:00Z')
    for (let s = 0; s < 12; s++) log.record(visit('/tactus', visitor, 200, minute + s * 5000))
    // another listener in the same city is counted with the first: nothing tells them apart
    log.record(visit('/tactus', { ...visitor, 'cf-connecting-ip': '203.0.113.9' }, 200, minute + 1000))
    log.record(visit('/tactus', { ...visitor, 'cf-ipcity': 'Tampere' }, 200, minute + 2000))
    log.record(visit('/tactus', visitor, 200, minute + 61_000))
    log.record(visit('/tactus', {}, 200, minute + 3000))
    log.flush()
    expect(log.db.query('select count(*) as n from requests').get()).toEqual({ n: 0 })
    expect(log.db.query('select minute, country, city, count from tactus order by minute, city').all()).toEqual([
      { minute, country: '', city: '', count: 1 },
      { minute, country: 'FI', city: 'Helsinki', count: 13 },
      { minute, country: 'FI', city: 'Tampere', count: 1 },
      { minute: minute + 60_000, country: 'FI', city: 'Helsinki', count: 1 },
    ])
    log.close()
    await gone(path)
  })

  it('outlives the Radio', async () => {
    const path = file()
    const first = new RequestLog(path, { flushEvery: 0 })
    first.record(visit('/', visitor))
    first.close()
    const again = new RequestLog(path, { flushEvery: 0 })
    again.record(visit('/s/1', visitor))
    again.flush()
    expect((again.db.query('select path from requests order by id').all() as { path: string }[]).map((r) => r.path)).toEqual(['/', '/s/1'])
    again.close()
    await gone(path)
  })

  it('never throws when it cannot write, and lets the rows go', async () => {
    const path = file()
    const log = new RequestLog(path, { flushEvery: 0 })
    log.db.exec('drop table requests')
    log.record(visit('/', visitor))
    expect(() => log.flush()).not.toThrow()
    log.db.close()
    expect(() => log.record(visit('/', visitor))).not.toThrow()
    expect(() => log.flush()).not.toThrow()
    await gone(path)
  })
})
