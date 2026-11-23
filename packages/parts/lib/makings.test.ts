import { describe, expect, it } from 'bun:test'
import { bridgeBeats, firstTune, phraseBeats } from 'melody'
import { arrange, firstLyrics, type Lyrics } from 'song'
import { readArrangements } from './arrangements.js'
import { readParts } from './registry.js'
import { makingsOf, resolve } from './timeline.js'
import { readTracks } from './tracks.js'

const records = await readParts()
const tracks = await readTracks()
const found = await readArrangements(records, undefined, tracks)
const arrangementOf = (id: string) => found.find(({ arrangement }) => arrangement.id === id)!.arrangement

const tempo = 72
const named = Object.fromEntries((Object.keys(firstLyrics) as (keyof Lyrics)[]).map((field) => [field, field])) as Lyrics
const sung = arrange(named)
const parts = sung.map(({ type }) => type)
/** How long a part lasts at the first tune, in beats: a bridge four bars, the rest the sum of their phrases. */
const beatsOfPart = (type: string) => (type === 'bridge' ? bridgeBeats : (type === 'chorus' ? firstTune.chorus : firstTune.verse).reduce((sum, phrase) => sum + phraseBeats(phrase), 0))
/** The kind of a bed, as the Studio keeps it (music/lib/sections.ts): a part's own, or a bridge's journey from the part before to the part after. */
const kindOf = (all: readonly string[], i: number) => (all[i] !== 'bridge' ? all[i]! : `bridge:${all[i - 1] === 'chorus' ? 'chorus' : 'verse'}>${all[i + 1] === 'chorus' ? 'chorus' : 'verse'}`)

const theSong = arrangementOf('the-song')
const beats = [...parts, ...parts].map(beatsOfPart)
const unmeasured = resolve(theSong, { beats, mood: tempo })

describe('resolve with measured seconds', () => {
  it('is the unmeasured timeline when what was measured is what the beats say', () => {
    const measured = resolve(theSong, { seconds: beats.map((length) => (length * 60) / tempo), mood: tempo })
    expect(measured.seconds).toBeCloseTo(unmeasured.seconds, 9)
    measured.regions.forEach((region, i) => {
      expect(region.startSeconds).toBeCloseTo(unmeasured.regions[i]!.startSeconds, 9)
      expect(region.seconds).toBeCloseTo(unmeasured.regions[i]!.seconds, 9)
      expect(region.beats).toBeCloseTo(unmeasured.regions[i]!.beats!, 9)
    })
    measured.blocks.forEach((block, i) => {
      expect(block.startSeconds).toBeCloseTo(unmeasured.blocks[i]!.startSeconds, 9)
      expect(block.endSeconds).toBeCloseTo(unmeasured.blocks[i]!.endSeconds, 9)
    })
  })

  it('lets a region last what it was sung for: what follows moves with it, and a Block placed by anchors follows its region', () => {
    const seconds = beats.map((length) => (length * 60) / tempo)
    // the third region was sung half a second longer
    seconds[2]! += 0.5
    const made = resolve(theSong, { seconds, mood: tempo })
    expect(made.regions[2]!.seconds).toBeCloseTo(unmeasured.regions[2]!.seconds + 0.5, 9)
    expect(made.regions[3]!.startSeconds).toBeCloseTo(unmeasured.regions[3]!.startSeconds + 0.5, 9)
    expect(made.regions[1]!.startSeconds).toBeCloseTo(unmeasured.regions[1]!.startSeconds, 9)
    expect(made.seconds).toBeCloseTo(unmeasured.seconds + 0.5, 9)
    // a Block that ends with that region (and three seconds more) ends where it ends now
    const bed = (resolved: typeof made, region: number) => resolved.blocks.find((block) => block.track === 'bed' && Math.abs(block.startSeconds - resolved.regions[region]!.startSeconds) < 1e-9)!
    expect(bed(made, 2).endSeconds).toBeCloseTo(bed(unmeasured, 2).endSeconds + 0.5, 9)
    expect(bed(made, 2).seconds).toBeCloseTo(bed(unmeasured, 2).seconds + 0.5, 9)
    // the beats of a region, counted from its seconds at its tempo
    expect(made.regions[2]!.beats).toBeCloseTo(((unmeasured.regions[2]!.seconds + 0.5) * tempo) / 60, 9)
  })

  it('takes the beats for a region not measured, and the measure for one that is, in free time too', () => {
    const turns = arrangementOf('tempo-turns')
    const lengths = turns.instances.map(({ part }) => beatsOfPart(part))
    const plain = resolve(turns, { beats: lengths, mood: tempo })
    // only the free bridge was measured: it was sung for 12.5 s, and not the ten it was given
    const measured = resolve(turns, { beats: lengths, seconds: turns.instances.map(({ name }) => (name === 'bridge-2' ? 12.5 : undefined)), mood: tempo })
    expect(measured.regions[3]!.seconds).toBe(12.5)
    expect(measured.regions[3]!.tempo).toBeNull()
    expect(measured.regions[4]!.startSeconds).toBeCloseTo(plain.regions[4]!.startSeconds + 2.5, 9)
    // a region under a tempo that was measured has its beats from the measure; none for free time
    const everything = resolve(turns, { seconds: plain.regions.map(({ seconds }) => seconds), mood: tempo })
    expect(everything.seconds).toBeCloseTo(plain.seconds, 9)
    expect(everything.regions[3]!.beats).toBeUndefined()
    expect(everything.regions[4]!.beats).toBeCloseTo(plain.regions[4]!.beats!, 9)
  })

  it('still needs the Mood\'s tempo for a region under it, and a length that is one', () => {
    expect(() => resolve(theSong, { seconds: beats.map(() => 10) })).toThrow("it is under the Mood's tempo")
    expect(() => resolve(theSong, { seconds: beats.map(() => -1), mood: tempo })).toThrow('its measured seconds are not a length')
    expect(() => resolve(theSong, { mood: tempo })).toThrow('its length in beats is not known')
  })
})

describe('what a timeline asks to be made', () => {
  const asked = makingsOf(unmeasured, tracks)
  const ofTrack = (id: string) => asked.filter(({ track }) => track === id)
  const names = theSong.instances.map(({ name }) => name)
  const pass = (making: (typeof asked)[number]) => (making.placings[0]!.at < unmeasured.regions[10]!.startSeconds ? 0 : 1)

  it("is, for the Song as it always was, per pass: a voice, a bed and a guide for each name (the chorus's two sections one), as the Studio makes them", () => {
    for (const p of [0, 1]) {
      // every name is sung, bedded and guided: the names that have words by their field, the chorus once for both its places, and each bridge a sound of its own
      const sungNames = [...new Set(names.slice(0, 10))]
      for (const track of ['voice', 'bed', 'guide']) {
        expect(ofTrack(track).filter((making) => pass(making) === p).map(({ source }) => source[0]).sort()).toEqual([...sungNames].sort())
      }
    }
    expect(ofTrack('voice')).toHaveLength(18)
    expect(ofTrack('bed')).toHaveLength(18)
    expect(ofTrack('guide')).toHaveLength(18)
  })

  it('lists each key once, from one source, with every place it is played, longest first in the length it is made', () => {
    expect(new Set(asked.map(({ track, key }) => `${track}:${key}`)).size).toBe(asked.length)
    const chorus = ofTrack('voice').find(({ key }) => key === 'voice:chorus')!
    expect(chorus.placings).toHaveLength(2)
    expect(chorus.source).toEqual(['chorus'])
    expect(chorus.seconds).toBeCloseTo(Math.max(...chorus.placings.map(({ seconds }) => seconds)), 9)
    // the chorus's two sections share a bed, as the Studio shares it (one guide, one bed): one key, two places
    const refrain = ofTrack('bed').find(({ key }) => key === 'bed:chorus')!
    expect(refrain.placings).toHaveLength(2)
    expect(refrain.source).toEqual(['chorus'])
    expect(ofTrack('bed').find(({ key }) => key === 'bed:verse-1')!.placings).toHaveLength(1)
    // a bed reaches past its section by its tail, and fades over it: that is in its Block
    for (const bed of ofTrack('bed')) for (const placing of bed.placings) expect(placing.fadeOut).toBe(3)
    expect(ofTrack('guide').every(({ heard }) => !heard)).toBe(true)
    expect(ofTrack('voice').concat(ofTrack('bed')).every(({ heard }) => heard)).toBe(true)
  })

  it('says the tempo each placing lies under: 72 throughout for the Song as it always was, and two for a chorus at two tempi, none in free time', () => {
    expect(asked.every((making) => making.placings.every(({ bpm }) => bpm === tempo))).toBe(true)
    const turns = arrangementOf('tempo-turns')
    const made = makingsOf(resolve(turns, { beats: turns.instances.map(({ part }) => beatsOfPart(part)), mood: tempo }), tracks)
    expect(made.find(({ key }) => key === 'voice:chorus')!.placings.map(({ bpm }) => bpm)).toEqual([72, 96])
    expect(made.find(({ key }) => key === 'guide:bridge-2')!.placings.map(({ bpm }) => bpm)).toEqual([null])
  })

  it('refuses a key placed from two sources, and a Block on a Track that is not there', () => {
    const blocks = unmeasured.blocks.map((block) => ({ ...block }))
    const refrain = blocks.filter((block) => block.key === 'bed:chorus')
    refrain[1]!.source = ['verse-2']
    expect(() => makingsOf({ blocks }, tracks)).toThrow('bed:chorus is placed from chorus and from verse-2: one key, one source')
    expect(() => makingsOf(unmeasured, tracks.filter(({ track }) => track.id !== 'guide'))).toThrow('which is not among the tracks: bed, voice')
    // a Track that is there and not heard keeps a guide off the air
    expect(makingsOf(unmeasured, tracks).filter(({ track }) => track === 'guide').every(({ heard }) => !heard)).toBe(true)
  })

  it('has every placing in the order of the timeline, and its key first where it is first played', () => {
    for (const making of asked) {
      const at = making.placings.map(({ at: moment }) => moment)
      expect(at).toEqual([...at].sort((a, b) => a - b))
    }
    expect(asked[0]!.key).toBe('voice:verse-1')
  })

  it('is, for tempo-turns, a sound placed twice at two tempi made once at the longest, and a bed under two regions', () => {
    const turns = arrangementOf('tempo-turns')
    const lengths = turns.instances.map(({ part }) => beatsOfPart(part))
    const made = makingsOf(resolve(turns, { beats: lengths, mood: tempo }), tracks)
    const chorus = made.find(({ key }) => key === 'voice:chorus')!
    expect(chorus.placings.map(({ seconds }) => Math.round(seconds * 10) / 10)).toEqual([30, 22.5])
    expect(chorus.seconds).toBeCloseTo(30, 9)
    const bed = made.find(({ key }) => key === 'bed:verse-1:and:bridge-1')!
    expect(bed.source).toEqual(['verse-1'])
    expect(bed.seconds).toBeGreaterThan(30 + 13)
    expect(made.find(({ key }) => key === 'guide:bridge-2')).toMatchObject({ heard: false, source: ['bridge-2'] })
    // measured, the same keys are asked for, at the measured lengths
    const measured = makingsOf(resolve(turns, { seconds: turns.instances.map(({ name }) => (name === 'bridge-2' ? 12 : undefined)), beats: lengths, mood: tempo }), tracks)
    expect(measured.map(({ key }) => key)).toEqual(made.map(({ key }) => key))
    expect(measured.find(({ key }) => key === 'guide:bridge-2')!.seconds).toBe(12)
  })
})
