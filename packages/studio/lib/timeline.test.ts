import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readArrangements, readParts, readTracks } from 'parts'
import type { Session } from 'archive'
import { madeFromSession } from './fixtures/archive.js'
import { toSession } from './session.js'
import { sessionOf } from './timeline.js'

const records = await readParts()
const tracks = await readTracks()
const theSong = (await readArrangements(records, undefined, tracks)).find(({ arrangement }) => arrangement.id === 'the-song')!.arrangement
const archived = (song: number) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/sessions/${song}.json`, import.meta.url)), 'utf8')) as Session
const name = (file: string) => file
const normal = (value: unknown) => JSON.parse(JSON.stringify(value))

describe('the Session from the timeline, for Songs in the Archive', () => {
  for (const song of [1855, 1862, 1864]) {
    it(`is, for Song ${song}, the Session toSession writes: deep, and in order`, () => {
      const made = madeFromSession(archived(song))
      const real = toSession(made, name, undefined, 'throat', 'a thought', 'A name')
      const shadow = sessionOf({ arrangement: theSong, tracks, made, name, throat: 'throat', thought: 'a thought', songName: 'A name' })
      expect(normal(shadow)).toEqual(normal(real))
      // and the stand-in made things are the Song's: what toSession writes is where its recordings lie
      const was = archived(song)
      expect(real.recordings.map(({ id, kind }) => [id, kind])).toEqual(was.recordings.map(({ id, kind }) => [id, kind]))
      expect((real.guides ?? []).map(({ id }) => id)).toEqual((was.guides ?? []).map(({ id }) => id))
      // the moments are the Archive's, to what a Session's thousandths and the stand-in lengths allow
      real.recordings.forEach(({ at }, i) => expect(Math.abs(at - was.recordings[i]!.at)).toBeLessThan(0.05))
      expect(Math.abs(real.seconds - was.seconds)).toBeLessThan(0.05)
    })
  }

  it('says where it differs, in a Song that has changed under it: a bed that is somewhere else', () => {
    const made = madeFromSession(archived(1862))
    made[1]!.beds[3]!.at += 0.5
    const real = toSession(made, name)
    const shadow = sessionOf({ arrangement: theSong, tracks, made, name })
    expect(normal(shadow)).not.toEqual(normal(real))
  })

  it('refuses a Song of other iterations than its Arrangement has', () => {
    const made = madeFromSession(archived(1862))
    expect(() => sessionOf({ arrangement: theSong, tracks, made: made.slice(0, 1), name })).toThrow('has 2 iterations, and 1 was made')
  })
})
