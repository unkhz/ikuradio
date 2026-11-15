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
