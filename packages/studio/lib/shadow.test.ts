import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Session } from 'archive'
import { madeFromSession } from './fixtures/archive.js'
import { toSession } from './session.js'
import { differences, shadowCheck } from './shadow.js'

const archived = (song: number) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/sessions/${song}.json`, import.meta.url)), 'utf8')) as Session
const name = (file: string) => file
const logs = () => {
  const said: string[] = []
  return { said, log: { log: (line: string) => said.push(line), warn: (line: string) => said.push(line) } }
}

describe('where two values differ', () => {
  it('says each place, with its path, and what it was and is', () => {
    expect(differences({ a: 1, list: [{ at: 43.3 }, { at: 5 }], same: 'x' }, { a: 1, list: [{ at: 43.4 }, { at: 5 }], same: 'x' })).toEqual(['list[0].at: 43.3 ≠ 43.4'])
    expect(differences({ a: 1 }, { b: 2 })).toEqual(['a: 1 ≠ missing', 'b: missing ≠ 2'])
    expect(differences({ list: [1, 2, 3] }, { list: [1, 9] })).toEqual(['list: 3 ≠ 2 entries', 'list[1]: 2 ≠ 9'])
    expect(differences({ a: { b: [1] } }, { a: { b: [1] } })).toEqual([])
    expect(differences(1, 2)).toEqual(['the Session: 1 ≠ 2'])
  })
})

describe('the shadow of a Song', () => {
  it('is silent about a Song the timeline writes as it was written: it says so once', async () => {
    const made = madeFromSession(archived(1862))
    const { said, log } = logs()
    const session = toSession(made, name)
    expect(await shadowCheck({ made, session, name }, log)).toEqual([])
    expect(said).toEqual(['shadow: the Session from the timeline "the-song" is the Session written'])
  })

  it('says every difference with its path when the Session written is not the one the timeline gives', async () => {
    const made = madeFromSession(archived(1862))
    const { said, log } = logs()
    const session = toSession(made, name)
    session.recordings[14]!.at += 0.1
    session.iterations[1]!.parts[2]!.seconds += 1
    const found = await shadowCheck({ made, session, name }, log)
    expect(found).toHaveLength(2)
    expect(found![0]).toMatch(/^iterations\[1\]\.parts\[2\]\.seconds: /)
    expect(found![1]).toMatch(/^recordings\[14\]\.at: /)
    expect(said[0]).toContain('differs from the Session written in 2 places')
    expect(said.slice(1).every((line) => line.startsWith('shadow:   '))).toBe(true)
  })

  it('works on a copy: what was made, and the Session written, are as they were after it', async () => {
    const made = madeFromSession(archived(1862))
    const session = toSession(made, name)
    const madeBefore = structuredClone(made)
    const sessionBefore = JSON.stringify(session)
    const { log } = logs()
    await shadowCheck({ made, session, name }, log)
    expect(made).toEqual(madeBefore)
    expect(JSON.stringify(session)).toBe(sessionBefore)
  })

  it('says loudly, and throws its result away, if the Session written changed while it was made', async () => {
    const made = madeFromSession(archived(1862))
    const session = toSession(made, name)
    let asked = 0
    // a Session that is not the same when it is looked at again
    Object.defineProperty(session, 'toJSON', { enumerable: false, value: () => ({ asked: ++asked }) })
    const { said, log } = logs()
    expect(await shadowCheck({ made, session, name }, log)).toBeUndefined()
    expect(said).toEqual(['shadow: the written Session was changed by the shadow: its result is thrown away'])
  })

  it('is not made if what was made cannot be copied, and says so', async () => {
    const made = madeFromSession(archived(1862))
    ;(made[0]!.composed as unknown as { tune: unknown }).tune = () => undefined
    const { said, log } = logs()
    expect(await shadowCheck({ made, session: toSession(madeFromSession(archived(1862)), name), name }, log)).toBeUndefined()
    expect(said[0]).toContain('what was made could not be copied, so the shadow is not made')
  })

  it('never throws: an Arrangement that is not there, or a Song that does not fit it, is said, and the Studio goes on', async () => {
    const made = madeFromSession(archived(1862))
    const session = toSession(made, name)
    const { said, log } = logs()
    expect(await shadowCheck({ made, session, name, arrangement: 'nothing' }, log)).toBeUndefined()
    expect(said[0]).toBe('shadow: the timeline could not write the Session: there is no active Arrangement "nothing"')
    const short = logs()
    expect(await shadowCheck({ made: made.slice(0, 1), session, name }, short.log)).toBeUndefined()
    expect(short.said[0]).toContain('could not write the Session: the Arrangement "the-song" has 2 iterations, and 1 was made')
  })
})
