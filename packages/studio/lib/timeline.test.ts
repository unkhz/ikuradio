import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readArrangements, readParts, readTracks } from 'parts'
import type { Session } from 'archive'
import { madeFromSession } from './fixtures/archive.js'
import { sessionOf } from './timeline.js'

const records = await readParts()
const tracks = await readTracks()
const theSong = (await readArrangements(records, undefined, tracks)).find(({ arrangement }) => arrangement.id === 'the-song')!.arrangement
const frozen = (song: number) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/expected/${song}.json`, import.meta.url)), 'utf8')) as Session
const archived = (song: number) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/sessions/${song}.json`, import.meta.url)), 'utf8')) as Session
const name = (file: string) => file
const normal = (value: unknown) => JSON.parse(JSON.stringify(value))

describe('the Session from the timeline, for Songs in the Archive', () => {
  for (const song of [1855, 1862, 1864]) {
    it(`is, for Song ${song}, the Session the Studio wrote before it wrote from the timeline: deep, and in order`, () => {
      // `fixtures/expected/<n>.json` is what the old `toSession` wrote for the made lines, guides and beds drawn from the Archive's Session, frozen when it was taken away
      const made = madeFromSession(archived(song))
      const shadow = sessionOf({ arrangement: theSong, tracks, made, name, throat: 'throat', thought: 'a thought', songName: 'A name' })
      const real = frozen(song)
      expect(normal(shadow)).toEqual(normal(real))
      // and the stand-in made things are the Song's: the recordings and guides lie in the order the Archive has them
      const was = archived(song)
      expect(shadow.recordings.map(({ id, kind }) => [id, kind])).toEqual(was.recordings.map(({ id, kind }) => [id, kind]))
      expect((shadow.guides ?? []).map(({ id }) => id)).toEqual((was.guides ?? []).map(({ id }) => id))
      // the moments are the Archive's, to what a Session's thousandths and the stand-in lengths allow
      shadow.recordings.forEach(({ at }, i) => expect(Math.abs(at - was.recordings[i]!.at)).toBeLessThan(0.05))
      expect(Math.abs(shadow.seconds - was.seconds)).toBeLessThan(0.05)
    })
  }

  it('places a bridge voice only where the bridge was hummed aloud: no recording, and no error, where it was not', () => {
    const count = (song: number) => {
      const made = madeFromSession(archived(song))
      const shadow = sessionOf({ arrangement: theSong, tracks, made, name })
      const bridges = made.flatMap(({ lines }) => lines.filter((line) => line.part === 'bridge'))
      const aloud = bridges.filter((line) => !line.unheard).length
      return { aloud, silent: bridges.length - aloud, voices: shadow.recordings.filter(({ kind, at }) => kind === 'voice' && shadow.iterations.some(({ parts }) => parts.some((part) => part.type === 'bridge' && Math.abs(part.at - at) < 1e-6))).length }
    }
    const counted = [1855, 1862, 1864].map(count)
    // one Session with a bridge hummed aloud and one that has a bridge not hummed, at least; the voices placed under bridges are the bridges hummed aloud, singers and all
    expect(counted.some(({ aloud }) => aloud > 0)).toBe(true)
    expect(counted.some(({ silent }) => silent > 0)).toBe(true)
    for (const { aloud, voices } of counted) expect(voices).toBeGreaterThanOrEqual(aloud)
  })

  it('places a bed where its Block says, not where it was made: a bed made elsewhere is placed all the same', () => {
    const made = madeFromSession(archived(1862))
    const was = sessionOf({ arrangement: theSong, tracks, made: structuredClone(made), name })
    made[1]!.beds[3]!.at += 0.5
    expect(normal(sessionOf({ arrangement: theSong, tracks, made, name }))).toEqual(normal(was))
  })

  it('finds a bed by its key: the bed of another key is another recording', () => {
    const made = madeFromSession(archived(1862))
    const keyed = made[0]!.beds.find(({ key }) => key === 'bed:verse-1')!
    keyed.file = 'another.m4a'
    const session = sessionOf({ arrangement: theSong, tracks, made, name })
    expect(session.recordings.filter(({ id }) => id === 'another.m4a')).toHaveLength(1)
  })

  it('refuses a Song of other iterations than its Arrangement has', () => {
    const made = madeFromSession(archived(1862))
    expect(() => sessionOf({ arrangement: theSong, tracks, made: made.slice(0, 1), name })).toThrow('has 2 iterations, and 1 was made')
  })
})
