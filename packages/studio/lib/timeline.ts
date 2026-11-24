// The Session from the timeline (plan "The Studio on timelines", steps 2 and 5). `sessionOf` writes a Song's Session from an Arrangement's timeline: the regions measured
// from the lines as they were sung, the Blocks resolved over them, and what was made (a voice's lines, a guide, a bed) placed where its Block says. It is what the Studio
// publishes. Before step 5 it was made in the shadow of the Session the Studio wrote by its own rules, and compared with it for eleven and then six Songs on the air;
// those rules are gone, and their answer on three Songs of the Archive is kept as JSON in fixtures/expected, to which `sessionOf` is held in timeline.test.ts.
//
// What was made is given as the iterations of `Made`. Beds and guides are made by key (step 4) and laid once for each place their key is placed, so each is found by its
// key: the nth made of a key is the nth placing of it. The Session says where each lies from the timeline's placing, never from the made thing's own moment.

import { fieldsOf, iterationsOf, makingsOf, resolve, type Arrangement, type TrackRecord } from 'parts'
import { introduce, type Loudness } from 'vocals'
import { sessionVersion, type Session, type SessionIteration } from 'archive'
import type { Guide } from './guide.js'
import type { SungLine } from './perform.js'
import { progressionRecord, seconds, takeOf, type Made } from './session.js'
import { measure } from './asking.js'
import { typingMoments } from './typing.js'

/** How close two moments are, in seconds, to be taken for one: well inside what a Session keeps (a thousandth). */
const same = 1e-6

/** What `sessionOf` is given beside the Arrangement and what was made: where the Tracks are, and the names and measures `toSession` is given. */
export type Shadow = {
  arrangement: Arrangement
  tracks: readonly TrackRecord[]
  made: readonly Made[]
  name: (file: string) => string
  loudness?: (file: string) => Loudness | undefined
  throat?: string
  thought?: string
  songName?: string
}

/** The Session of a Song, written from its Arrangement's timeline over what the Studio made. */
export function sessionOf({ arrangement, tracks, made, name, loudness = () => undefined, throat, thought, songName }: Shadow): Session {
  const heard = (file: string) => {
    const measured = loudness(file)
    return measured ? { loudness: measured } : {}
  }
  const instances = arrangement.instances
  const passOf = iterationsOf(instances, arrangement.turns)
  const passes = Math.max(0, ...passOf) + 1
  if (passes !== made.length) throw new Error(`the Arrangement "${arrangement.id}" has ${passes} iteration${passes > 1 ? 's' : ''}, and ${made.length} ${made.length === 1 ? 'was' : 'were'} made`)
  const [{ composed: first }] = made
  const { mood, choir, song } = first

  // the words of each region, by name, and so the lines it was sung in: a region without words (a bridge) is one line
  const fields = fieldsOf(instances)
  const lines: SungLine[][] = instances.map(() => [])
  const measured: number[] = instances.map(() => 0)
  for (let pass = 0; pass < passes; pass++) {
    const regions = instances.flatMap((instance, global) => (passOf[global] === pass ? [{ global, index: 0, name: instance.name, part: instance.part as 'verse' | 'chorus' | 'bridge', ...(fields[global] ? { field: fields[global] } : {}) }] : []))
    const own = measure(regions, made[pass]!.composed.lyrics, made[pass]!.lines)
    for (const [n, region] of regions.entries()) {
      lines[region.global] = own.lines[n]!
      measured[region.global] = own.seconds[n]!
    }
  }
  const resolved = resolve(arrangement, { seconds: measured, mood: mood.character.tempo })
  const asked = makingsOf(resolved, tracks)

  // where each iteration begins and how long it lasts: from its first region to the end of its last
  const firstOf = (pass: number) => passOf.indexOf(pass)
  const lastOf = (pass: number) => passOf.lastIndexOf(pass)
  const begins = (pass: number) => resolved.regions[firstOf(pass)]!.startSeconds
  const lasts = (pass: number) => resolved.regions[lastOf(pass)]!.startSeconds + resolved.regions[lastOf(pass)]!.seconds - begins(pass)
  const regionAt = (at: number) => {
    const exact = resolved.regions.findIndex((region) => Math.abs(region.startSeconds - at) < same)
    if (exact >= 0) return exact
    const inside = resolved.regions.findIndex((region) => at >= region.startSeconds - same && at < region.startSeconds + region.seconds - same)
    if (inside >= 0) return inside
    return at < 0 ? 0 : resolved.regions.length - 1
  }

  // what a Track's placing at a moment is, if any: the key placed there, and where it is first made
  const findPlaced = (track: string, region: number) => {
    for (const making of asked) {
      if (making.track !== track) continue
      const placing = making.placings.find((one) => Math.abs(one.at - resolved.regions[region]!.startSeconds) < same)
      if (placing) return { making, placing, from: regionAt(making.placings[0]!.at) }
    }
    return undefined
  }

  const iterations: SessionIteration[] = []
  const recordings: Session['recordings'] = []
  const guides: NonNullable<Session['guides']> = []

  for (let pass = 0; pass < passes; pass++) {
    const { composed, beds, guides: hummed = [] } = made[pass]!
    const offset = begins(pass)
    const parts = []
    const voices: Session['recordings'] = []
    for (let r = firstOf(pass); r <= lastOf(pass); r++) {
      const region = resolved.regions[r]!
      const wordless = fields[r] === undefined
      // what sings it is made once, by its key, and placed where its Block says; a silent region (e.g. a bridge with no voice Block) has none
      const placed = findPlaced('voice', r)
      const at = placed ? placed.placing.at : region.startSeconds
      const sung = placed ? (lines[placed.from] ?? []) : []
      const start = sung[0]?.at ?? 0
      const partIndex = r - firstOf(pass)
      parts.push({
        type: region.part as 'verse' | 'chorus' | 'bridge',
        at: seconds(at),
        seconds: seconds(region.seconds),
        ...(region.tempo !== mood.character.tempo ? { tempo: region.tempo } : {}),
        lines: wordless
          ? []
          : sung.map((line, index) => ({
              text: line.lyrics,
              at: seconds(at + (line.at - start)),
              typing: typingMoments(line.lyrics, line.voiced, `${composed.iteration}:${partIndex}:${index}`).map((moment) => Math.round(line.enters * 1000 + moment)),
              ...(line.grown ? { grown: line.grown } : {}),
              ...(line.quickest !== undefined && Number.isFinite(line.quickest) ? { quickest: line.quickest } : {}),
            })),
      })
      // every singer's own take, so that a Receiver can sing them and mix them as it likes
      if (placed) {
        for (const [lineIndex, line] of sung.entries()) {
          if (line.unheard) continue
          for (const { file, voice, gain, take } of line.voices) {
            voices.push({
              id: name(file),
              ...(take ? { take: takeOf(take) } : {}),
              at: seconds(at + (line.at - start)),
              kind: 'voice',
              voice,
              ...(gain !== 1 ? { gain } : {}),
              seconds: seconds(line.seconds),
              ...(lineIndex === 0 && placed.placing.fadeIn ? { fadeIn: placed.placing.fadeIn } : {}),
              ...heard(file),
            })
          }
        }
      }

    }
    iterations.push({
      iteration: `${composed.iteration}`,
      at: seconds(offset),
      seconds: seconds(lasts(pass)),
      variation: composed.variation,
      ...(composed.tides?.length ? { tides: composed.tides.map(({ slug, value, phase, through }) => ({ slug, value, phase, through })) } : {}),
      of: { at: Number(composed.iteration - BigInt(composed.song.began)) + 1, of: composed.song.lasts },
      parts,
    })
    recordings.push(...voices)

    // the beds: each placing of a bed Block, in the order of the timeline; a bed was grown once for its key
    const bedPlacings = asked
      .filter((making) => making.track === 'bed')
      .flatMap((making) => making.placings.map((placing) => ({ making, placing })))
      .filter(({ placing }) => passOf[regionAt(placing.at)] === pass)
      .sort((a, b) => a.placing.at - b.placing.at)
    const bedsOf = new Map<string, number>()
    for (const { making, placing } of bedPlacings) {
      // the bed of a key, placing by placing: its first made place is its first placing
      const nth = bedsOf.get(making.key) ?? 0
      bedsOf.set(making.key, nth + 1)
      const bed = beds.filter((one) => one.key === making.key)[nth]
      // a bed that was not grown has none to place
      if (!bed) continue
      recordings.push({
        id: name(bed.file),
        at: seconds(placing.at),
        gain: placing.gain,
        kind: 'bed',
        // a bed's place is its Block less its tail, and the tail is the fade the Session says: what the bed holds beyond its place fades under what follows
        seconds: seconds(placing.seconds - placing.fadeOut),
        ...(placing.fadeIn ? { fadeIn: placing.fadeIn } : {}),
        ...(placing.fadeOut ? { fade: placing.fadeOut } : {}),
        ...heard(bed.file),
      })
    }

    // the guides, for the Music alone: each placing of a guide Block that a guide was hummed for
    const guidePlacings = asked
      .filter((making) => making.track === 'guide')
      .flatMap((making) => making.placings.map((placing) => ({ making, placing })))
      .filter(({ placing }) => passOf[regionAt(placing.at)] === pass)
      .sort((a, b) => a.placing.at - b.placing.at)
    const guidesOf = new Map<string, number>()
    for (const { making, placing } of guidePlacings) {
      const nth = guidesOf.get(making.key) ?? 0
      guidesOf.set(making.key, nth + 1)
      const guide: Guide | undefined = hummed.filter((one) => one.key === making.key)[nth]
      if (!guide) continue
      const [, fromPart, toPart] = /^bridge:(\w+)>(\w+)$/.exec(guide.kind) ?? []
      guides.push({
        id: name(guide.file),
        ...(guide.take ? { take: takeOf(guide.take) } : {}),
        kind: 'guide',
        part: guide.part,
        ...(fromPart && toPart ? { from: fromPart as 'verse' | 'chorus', to: toPart as 'verse' | 'chorus' } : {}),
        at: seconds(placing.at),
        seconds: seconds(placing.seconds),
        score: guide.score,
        ...(guide.lower ? { lower: { take: takeOf(guide.lower.take), body: guide.lower.body } } : {}),
        ...(guide.composed ? { chords: guide.composed.chords, furthest: guide.composed.furthest } : {}),
        ...(guide.rendering ? { rendering: guide.rendering } : {}),
        ...(guide.melody ? { melody: guide.melody } : {}),
        ...(guide.progression ? { progression: progressionRecord(guide.progression) } : {}),
      })
    }
  }

  return {
    version: sessionVersion,
    song: song.number,
    arrangement: arrangement.id,
    ...(songName ? { name: songName } : {}),
    mood: mood.descriptions,
    mode: mood.character.mode,
    tempo: mood.character.tempo,
    ...(mood.character.sound ? { sound: mood.character.sound } : {}),
    choir: introduce(choir),
    ...(thought ? { thought } : {}),
    ...(first.rate ? { rate: first.rate } : {}),
    ...(first.perspectives?.length ? { perspectives: first.perspectives.map(({ slug, title, facet, variant }) => ({ slug, title, facet, ...(variant ? { variant } : {}) })) } : {}),
    singers: choir.map(({ body, harmony }) => ({ body, harmony })),
    ...(throat ? { throat } : {}),
    seconds: seconds(resolved.seconds),
    iterations,
    recordings,
    ...(guides.length ? { guides } : {}),
  }
}
