import { describe, expect, it } from 'bun:test'
import { bridgeBeats, firstTune, phraseBeats } from 'melody'
import { arrange, firstLyrics, type Lyrics } from 'song'
import { ending, placesOf, refuseArrangement } from './arrangement.js'
import { readArrangements } from './arrangements.js'
import { readParts } from './registry.js'
import { resolve } from './timeline.js'
import { readTracks } from './tracks.js'

const records = await readParts()
const tracks = await readTracks()
const found = await readArrangements(records, undefined, tracks)
const arrangementOf = (id: string) => found.find(({ arrangement }) => arrangement.id === id)!.arrangement

const tempo = 72
const named = Object.fromEntries((Object.keys(firstLyrics) as (keyof Lyrics)[]).map((field) => [field, field])) as Lyrics
const sung = arrange(named)

// ---- today's rules, written out from the Studio's and the Music's code (they are not imported)

/** How long a part lasts at the first tune, from its phrases (a verse and a chorus are four lines of them, a bridge sixteen beats), in beats. */
const beatsOfPart = (type: string) => (type === 'bridge' ? bridgeBeats : (type === 'chorus' ? firstTune.chorus : firstTune.verse).reduce((sum, phrase) => sum + phraseBeats(phrase), 0))
/** The seconds a bed is grown past its section (music/lib/bed.ts), the gain it is laid at (music/lib/underlay.ts) and the fade it is given: `tail`. */
const tail = 3
const bedGain = 0.45
/** The kind of a bed (music/lib/sections.ts): a part's own, or a bridge's journey: from the part before, to the part after (a chorus, else a verse). */
const kindOf = (parts: readonly string[], i: number) => (parts[i] !== 'bridge' ? parts[i]! : `bridge:${parts[i - 1] === 'chorus' ? 'chorus' : 'verse'}>${parts[i + 1] === 'chorus' ? 'chorus' : 'verse'}`)

describe('the Song as a timeline is what the Studio lays out today, for a Song of two iterations', () => {
  const theSong = arrangementOf('the-song')
  const parts = sung.map(({ type }) => type)
  const resolved = resolve(theSong, { beats: [...parts, ...parts].map(beatsOfPart), mood: tempo })
  const passes = [0, 1]
  const regionsOf = (pass: number) => resolved.regions.slice(pass * 10, pass * 10 + 10)
  const iterationSeconds = parts.reduce((sum, type) => sum + (beatsOfPart(type) * 60) / tempo, 0)

  it('checks, with the Tracks there are', () => {
    expect(refuseArrangement(theSong, records, tracks)).toBeUndefined()
    expect(theSong.tracks).toEqual(['voice', 'bed', 'guide'])
  })

  it('lists its ten names twice, and turns once: at the second hearing of the first verse', () => {
    const names = theSong.instances.slice(0, 10).map(({ name }) => name)
    expect(theSong.instances.slice(10).map(({ name }) => name)).toEqual(names)
    expect(theSong.turns).toEqual([{ region: 'verse-1', hearing: 2, edge: 'start' }])
    expect(theSong.instances.some(({ name, continues }) => name.endsWith('-again') || continues !== undefined)).toBe(false)
    expect(resolved.iterations).toBe(2)
    expect(resolved.regions.map(({ iteration }) => iteration)).toEqual([...Array(10).fill(0), ...Array(10).fill(1)])
  })

  it("comes home as the Studio does, in both iterations: a chorus, or the last of an iteration, ends full, else half", () => {
    // the rule perform.ts keeps, written out: part === 'chorus' || last of the iteration ? 'full' : 'half'
    const today = (type: string, i: number) => (type === 'chorus' || i % 10 === 9 ? 'full' : 'half')
    const places = placesOf(theSong, 2548n)
    const byId = new Map(records.map(({ part }) => [part.id, part]))
    for (const [i, { part }] of theSong.instances.entries()) {
      // the part arrange() gives here: the final chorus is a verse by kind, and comes home by what its instance says
      expect(ending(byId.get(part)!, places[i]!)).toBe(today(sung[i % 10]!.type, i))
    }
    expect(theSong.instances.filter(({ ending: e }) => e !== undefined).map(({ name, ending: e }) => `${name}:${e}`)).toEqual(['final-chorus:full', 'final-chorus:full'])
  })

  it('has the same regions in the same order and timing: the parts arrange() gives, and the second pass beginning where the first ends', () => {
    expect(resolved.regions.map(({ part }) => part)).toEqual([...parts, ...parts])
    let at = 0
    for (const [i, region] of resolved.regions.entries()) {
      expect(region.startSeconds).toBeCloseTo(at, 9)
      expect(region.seconds).toBeCloseTo((beatsOfPart(region.part) * 60) / tempo, 9)
      at += region.seconds
      if (i === 9) expect(at).toBeCloseTo(iterationSeconds, 9)
    }
    expect(regionsOf(1)[0]!.startSeconds).toBeCloseTo(iterationSeconds, 9)
    expect(resolved.seconds).toBeCloseTo(2 * iterationSeconds, 9)
    // one tempo, the Mood's, throughout, and so one segment
    expect(resolved.regions.every(({ tempo: t, segment }) => t === tempo && segment === 0)).toBe(true)
  })

  it("has a bed under every region, grown past it by `tail` and faded by `tail`, at the Music's gain", () => {
    const beds = resolved.blocks.filter(({ track }) => track === 'bed')
    expect(beds).toHaveLength(20)
    beds.forEach((bed, i) => {
      const region = resolved.regions[i]!
      expect(bed.startSeconds).toBeCloseTo(region.startSeconds, 9)
      expect(bed.endSeconds).toBeCloseTo(region.startSeconds + region.seconds + tail, 9)
      expect(bed.seconds).toBeCloseTo(region.seconds + tail, 9)
      expect(bed.fadeOut).toBe(tail)
      expect(bed.fadeIn).toBe(0)
      expect(bed.gain).toBe(bedGain)
    })
  })

  it('shares the beds as the Music does: one to a kind of part in an iteration, and nothing shared between two', () => {
    const beds = resolved.blocks.filter(({ track }) => track === 'bed')
    const partition = (keys: readonly string[]) => keys.map((key) => keys.indexOf(key))
    // what today's rule says of each region's bed: its pass, and its kind
    const today = [0, 1].flatMap((pass) => parts.map((_, i) => `${pass}:${kindOf(parts, i)}`))
    expect(partition(beds.map(({ key }) => key))).toEqual(partition(today))
    // and a bed of the second pass is nobody's of the first
    const keysOf = (blocks: typeof beds, pass: number) => new Set(blocks.slice(pass * 10, pass * 10 + 10).map(({ key }) => key))
    for (const key of keysOf(beds, 1)) expect(keysOf(beds, 0).has(key)).toBe(false)
  })

  it('has a guide under every region, not heard, shared the same way as the beds', () => {
    const guides = resolved.blocks.filter(({ track }) => track === 'guide')
    const beds = resolved.blocks.filter(({ track }) => track === 'bed')
    expect(guides).toHaveLength(20)
    guides.forEach((guide, i) => {
      expect(guide.startSeconds).toBeCloseTo(resolved.regions[i]!.startSeconds, 9)
      expect(guide.seconds).toBeCloseTo(resolved.regions[i]!.seconds, 9)
    })
    const partition = (keys: readonly string[]) => keys.map((key) => keys.indexOf(key))
    expect(partition(guides.map(({ key }) => key))).toEqual(partition(beds.map(({ key }) => key)))
    expect(tracks.find(({ track }) => track.id === 'guide')!.track.heard).toBe(false)
  })

  it('sings each region that has words by a voice, the chorus heard twice in a pass being one sound, and the second pass all new', () => {
    const voices = resolved.blocks.filter(({ track }) => track === 'voice')
    // the regions with words: what arrange() gives content to, twice
    const withWords = [...sung, ...sung].flatMap((part, i) => (part.content ? [i] : []))
    expect(voices).toHaveLength(withWords.length)
    voices.forEach((voice, k) => {
      const region = resolved.regions[withWords[k]!]!
      expect(voice.startSeconds).toBeCloseTo(region.startSeconds, 9)
      expect(voice.endSeconds).toBeCloseTo(region.startSeconds + region.seconds, 9)
      expect(voice.fadeOut).toBe(0)
    })
    // sharing: today a field's words are one set of takes: the same field is the same sound, in an iteration
    const field = withWords.map((i) => `${i < 10 ? 0 : 1}:${sung[i % 10]!.content}`)
    const partition = (keys: readonly string[]) => keys.map((key) => keys.indexOf(key))
    expect(partition(voices.map(({ key }) => key))).toEqual(partition(field))
    expect(new Set(voices.map(({ key }) => key)).size).toBe(10)
  })

  it('says what a bed grows from: the first region of its kind in its pass', () => {
    for (const pass of passes) {
      const regions = regionsOf(pass)
      const names = theSong.instances.slice(pass * 10, pass * 10 + 10).map(({ name }) => name)
      const beds = resolved.blocks.filter(({ track }) => track === 'bed').slice(pass * 10, pass * 10 + 10)
      beds.forEach((bed, i) => {
        const first = parts.findIndex((_, k) => kindOf(parts, k) === kindOf(parts, i))
        expect(bed.source).toEqual([names[first]!])
        expect(regions[i]!.name).toBe(names[i]!)
      })
    }
  })
})

describe('tempo-turns proves what the Song cannot', () => {
  const turns = arrangementOf('tempo-turns')
  const lengths = turns.instances.map(({ part }) => beatsOfPart(part))
  const resolved = resolve(turns, { beats: lengths, mood: tempo })

  it('checks, and is one pass of seven regions', () => {
    expect(refuseArrangement(turns, records, tracks)).toBeUndefined()
    expect(turns.instances.map(({ name }) => name)).toEqual(['verse-1', 'bridge-1', 'chorus', 'bridge-2', 'chorus', 'bridge-3', 'verse-2'])
  })

  it('has its second bridge in free time, hummed, with its own seconds and no beats', () => {
    const bridge = resolved.regions[3]!
    expect(bridge).toMatchObject({ name: 'bridge-2', tempo: null, seconds: 10 })
    expect(bridge.beats).toBeUndefined()
    expect(bridge.startBeats).toBeUndefined()
    const guide = resolved.blocks.find(({ key }) => key === 'guide:bridge-2')!
    expect(guide).toMatchObject({ startSeconds: bridge.startSeconds, seconds: 10 })
    expect(guide.beats).toBeUndefined()
    expect(tracks.find(({ track }) => track.id === 'guide')!.track.heard).toBe(false)
  })

  it('has the chorus after it at another tempo, and the first tempo back for the last verse', () => {
    expect(resolved.regions.map(({ tempo: t }) => t)).toEqual([72, 72, 72, null, 96, 96, 72])
    expect(resolved.regions.map(({ segment }) => segment)).toEqual([0, 0, 0, 1, 2, 2, 3])
    // 36 beats at 96 is 22.5 s; at 72 it was 30 s: the seconds run on from each change, the beats begin again
    expect(resolved.regions[4]).toMatchObject({ startBeats: 0, seconds: 22.5, beats: 36 })
    expect(resolved.regions[5]!.startBeats).toBe(36)
    expect(resolved.regions[6]).toMatchObject({ startBeats: 0, tempo: 72, seconds: 30 })
    const seconds = resolved.regions.map(({ seconds: s }) => s)
    expect(seconds[0]).toBeCloseTo(30, 9)
    expect(resolved.seconds).toBeCloseTo(30 + 40 / 3 + 30 + 10 + 22.5 + 10 + 30, 9)
  })

  it('has one bed running under two regions, the verse and the bridge after it', () => {
    const bed = resolved.blocks.find(({ key }) => key === 'bed:verse-1:and:bridge-1')!
    expect(bed.startSeconds).toBe(0)
    // from the start of the verse to 3 seconds past the end of the bridge after it: two regions' length and the tail
    expect(bed.endSeconds).toBeCloseTo(resolved.regions[1]!.startSeconds + resolved.regions[1]!.seconds + 3, 9)
    expect(bed.seconds).toBeCloseTo(30 + 40 / 3 + 3, 9)
    expect(bed.fadeOut).toBe(3)
    // under one tempo, so it has beats
    expect(bed.beats).toBeCloseTo(((30 + 40 / 3 + 3) * tempo) / 60, 9)
  })

  it('shares a sound placed again: the chorus is one voice and one bed, at two tempi', () => {
    const voices = resolved.blocks.filter(({ key }) => key === 'voice:chorus')
    const beds = resolved.blocks.filter(({ key }) => key === 'bed:chorus')
    expect(voices).toHaveLength(2)
    expect(beds).toHaveLength(2)
    expect(voices[0]!.seconds).not.toBeCloseTo(voices[1]!.seconds, 3)
    expect(voices[0]!.source).toEqual(voices[1]!.source)
  })

  it("keeps the last bed's tail past the Song's end in the last region, under its tempo", () => {
    const last = resolved.blocks.filter(({ track }) => track === 'bed').at(-1)!
    expect(last.endSeconds).toBeCloseTo(resolved.seconds + 3, 9)
    expect(last.beats).toBeCloseTo(((30 + 3) * tempo) / 60, 9)
  })
})
