// The Session from the timeline (plan "The Studio on timelines", step 2). `toSession` lays a Song down by the rules the Studio keeps in code: every line end
// to end, every bed under its section. `sessionOf` writes the same Session from an Arrangement's timeline: the regions measured from the lines as they were
// sung, the Blocks resolved over them, and what was made (a voice's lines, a guide, a bed) placed where its Block says. It is made in the shadow of the real
// one, beside it and unpublished, and the two are compared (./shadow.ts), until the Songs on the air have shown them the same.
//
// What was made is given as the iterations of `Made`, as the Studio makes them today: the made things are found by where they lie in time, since today they
// are kept by position. When the Studio makes by key (step 4), they will be given by key, and the finding goes.

import { fieldsOf, iterationsOf, makingsOf, resolve, type Arrangement, type TrackRecord } from 'parts'
import { introduce, type Loudness } from 'vocals'
import { sessionVersion, type Session, type SessionIteration } from 'archive'
import type { Guide } from './guide.js'
import type { SungLine } from './perform.js'
import { progressionRecord, seconds, takeOf, type Made } from './session.js'
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
    const { lyrics } = made[pass]!.composed
    let cursor = 0
    for (const [r, field] of fields.entries()) {
      if (passOf[r] !== pass) continue
      const texts = field === undefined ? [''] : (lyrics[field] as string).split('\n').filter((text) => text.trim())
      lines[r] = texts.map(() => made[pass]!.lines[cursor++]).filter((line): line is SungLine => line !== undefined)
      const at = lines[r]![0]?.at ?? 0
      const end = Math.max(at, ...lines[r]!.map((line) => line.at + line.seconds))
      // a region lasts what it was sung for
      measured[r] = end - at
    }
  }
  const resolved = resolve(arrangement, { seconds: measured, mood: mood.character.tempo })
  const asked = makingsOf(resolved, tracks)

  // where each iteration begins and how long it lasts: from its first region to the end of its last
  const firstOf = (pass: number) => passOf.indexOf(pass)
  const lastOf = (pass: number) => passOf.lastIndexOf(pass)
  const begins = (pass: number) => resolved.regions[firstOf(pass)]!.startSeconds
  const lasts = (pass: number) => resolved.regions[lastOf(pass)]!.startSeconds + resolved.regions[lastOf(pass)]!.seconds - begins(pass)
  const regionAt = (at: number) => resolved.regions.findIndex((region) => Math.abs(region.startSeconds - at) < same)

  // what a Track's placing at a moment is: the key placed there, and where it is first made
  const placedAt = (track: string, region: number) => {
    for (const making of asked) {
      if (making.track !== track) continue
      const placing = making.placings.find((one) => Math.abs(one.at - resolved.regions[region]!.startSeconds) < same)
      if (placing) return { making, placing, from: regionAt(making.placings[0]!.at) }
    }
    throw new Error(`region ${region + 1} ("${instances[region]!.name}") has no ${track} Block starting where it does`)
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
      // what sings it is made once, by its key, and placed where its Block says: the lines of the first region the key lies under
      const { making, placing, from } = placedAt('voice', r)
      const sung = lines[from] ?? []
      const start = sung[0]?.at ?? 0
      const partIndex = r - firstOf(pass)
      parts.push({
        type: region.part as 'verse' | 'chorus' | 'bridge',
        at: seconds(placing.at),
        seconds: seconds(region.seconds),
        lines: wordless
          ? []
          : sung.map((line, index) => ({
              text: line.lyrics,
              at: seconds(placing.at + (line.at - start)),
              typing: typingMoments(line.lyrics, line.voiced, `${composed.iteration}:${partIndex}:${index}`).map((moment) => Math.round(line.enters * 1000 + moment)),
              ...(line.grown ? { grown: line.grown } : {}),
              ...(line.quickest !== undefined && Number.isFinite(line.quickest) ? { quickest: line.quickest } : {}),
            })),
      })
      // every singer's own take, so that a Receiver can sing them and mix them as it likes
      for (const line of sung) {
        if (line.unheard) continue
        for (const { file, voice, gain, take } of line.voices) {
          voices.push({
            id: name(file),
            ...(take ? { take: takeOf(take) } : {}),
            at: seconds(placing.at + (line.at - start)),
            kind: 'voice',
            voice,
            ...(gain !== 1 ? { gain } : {}),
            seconds: seconds(line.seconds),
            ...heard(file),
          })
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

    // the beds: each placing of a bed Block, in the order of the timeline; made once by its key, found by where the Studio put it
    const bedPlacings = asked
      .filter((making) => making.track === 'bed')
      .flatMap((making) => making.placings.map((placing) => ({ making, placing })))
      .filter(({ placing }) => passOf[regionAt(placing.at)] === pass)
      .sort((a, b) => a.placing.at - b.placing.at)
    for (const { placing } of bedPlacings) {
      const bed = beds.find((one) => Math.abs(offset + one.at - placing.at) < same)
      // a section whose bed was not grown has none to place
      if (!bed) continue
      recordings.push({
        id: name(bed.file),
        at: seconds(placing.at),
        gain: placing.gain,
        kind: 'bed',
        // a bed's place is its Block less its tail, and the tail is the fade the Session says: what the bed holds beyond its place fades under what follows
        seconds: seconds(placing.seconds - placing.fadeOut),
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
    for (const { placing } of guidePlacings) {
      const guide: Guide | undefined = hummed.find((one) => Math.abs(offset + one.at - placing.at) < same)
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
