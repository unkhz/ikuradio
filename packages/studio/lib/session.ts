// Writing a Song down as its Session: every iteration laid end to end, every
// line at its moment with its typing decided, every Recording at its place.

import { arrange } from 'song'
import { introduce, type Loudness, type Placed, type Take } from 'vocals'
import { sessionVersion, type Session, type SessionIteration } from 'archive'
import type { Iteration } from './compose.js'
import type { SungLine } from './perform.js'
import type { Guide } from './guide.js'
import { typingMoments } from './typing.js'

/** One iteration as the Studio made it: composed, sung, and with its beds. */
export type Made = {
  composed: Iteration
  lines: SungLine[]
  beds: Placed[]
  /** The guide hums the Music grew the beds from. */
  guides?: Guide[]
}

const seconds = (n: number) => Math.round(n * 1000) / 1000

/** A take as a Session keeps it: only what the throat reads. */
const takeOf = ({ bpm, lyrics, notes, t0, vibrato, pressure, tension, breathiness }: Take) => ({
  bpm,
  lyrics,
  notes,
  t0,
  vibrato,
  ...(pressure !== undefined ? { pressure } : {}),
  ...(tension !== undefined ? { tension } : {}),
  ...(breathiness !== undefined ? { breathiness } : {}),
})

/** How long an iteration lasts: until its last line has had its place. */
export function lengthOf(lines: readonly SungLine[]) {
  return Math.max(0, ...lines.map(({ at, seconds }) => at + seconds))
}

/**
 * The Session of a Song, from its iterations as the Studio made them. Every
 * moment is counted from the Song's beginning; `name` maps a recording's
 * file to its id in the Archive, and `loudness` to how loud it was measured
 * to sound, if it was. `throat` names the throat the voices were sung with,
 * and `thought` is what the mind thought of the Song, if it thought anything.
 */
export function toSession(
  made: readonly Made[],
  name: (file: string) => string,
  loudness: (file: string) => Loudness | undefined = () => undefined,
  throat?: string,
  thought?: string,
): Session {
  const heard = (file: string) => {
    const measured = loudness(file)
    return measured ? { loudness: measured } : {}
  }
  const [{ composed: first }] = made
  const { mood, choir, song } = first
  let offset = 0
  const iterations: SessionIteration[] = []
  const recordings: Session['recordings'] = []
  const guides: NonNullable<Session['guides']> = []

  for (const { composed, lines, beds, guides: hummed = [] } of made) {
    // the performance is in the order the parts are sung, a line at a time;
    // the chorus comes twice, each time at its own moment
    let cursor = 0
    const parts = arrange(composed.lyrics).map((part) => {
      const texts = part.type === 'bridge' ? [''] : part.content.split('\n').filter((t) => t.trim())
      const placed = texts.map(() => lines[cursor++]).filter((line) => line !== undefined)
      const at = placed[0]?.at ?? 0
      const end = Math.max(at, ...placed.map((line) => line.at + line.seconds))
      return {
        type: part.type,
        at: seconds(offset + at),
        seconds: seconds(end - at),
        lines:
          part.type === 'bridge'
            ? []
            : placed.map((line, index) => ({
                text: line.lyrics,
                at: seconds(offset + line.at),
                typing: typingMoments(
                  line.lyrics,
                  line.voiced,
                  `${composed.iteration}:${part.index}:${index}`,
                ).map((moment) => Math.round(line.enters * 1000 + moment)),
                ...(line.grown ? { grown: line.grown } : {}),
                ...(line.quickest !== undefined && Number.isFinite(line.quickest) ? { quickest: line.quickest } : {}),
              })),
      }
    })
    const length = lengthOf(lines)
    iterations.push({
      iteration: `${composed.iteration}`,
      at: seconds(offset),
      seconds: seconds(length),
      variation: composed.variation,
      of: {
        at: Number(composed.iteration - BigInt(composed.song.began)) + 1,
        of: composed.song.lasts,
      },
      parts,
    })
    // every singer's own take, so that a Receiver can sing them and mix them as it likes
    for (const line of lines) {
      if (line.unheard) continue
      for (const { file, voice, gain, take } of line.voices) {
        recordings.push({
          id: name(file),
          ...(take ? { take: takeOf(take) } : {}),
          at: seconds(offset + line.at),
          kind: 'voice',
          voice,
          ...(gain !== 1 ? { gain } : {}),
          seconds: seconds(line.seconds),
          ...heard(file),
        })
      }
    }
    for (const bed of beds) {
      recordings.push({
        id: name(bed.file),
        at: seconds(offset + bed.at),
        gain: bed.gain,
        kind: 'bed',
        ...(bed.seconds !== undefined ? { seconds: seconds(bed.seconds) } : {}),
        ...(bed.fade ? { fade: bed.fade } : {}),
        ...heard(bed.file),
      })
    }
    for (const guide of hummed) {
      const [, from, to] = /^bridge:(\w+)>(\w+)$/.exec(guide.kind) ?? []
      guides.push({
        id: name(guide.file),
        ...(guide.take ? { take: takeOf(guide.take) } : {}),
        kind: 'guide',
        part: guide.part,
        ...(from && to ? { from: from as 'verse' | 'chorus', to: to as 'verse' | 'chorus' } : {}),
        at: seconds(offset + guide.at),
        seconds: seconds(guide.seconds),
        score: guide.score,
        ...(guide.lower ? { lower: { take: takeOf(guide.lower.take), body: guide.lower.body } } : {}),
        ...(guide.composed ? { chords: guide.composed.chords, furthest: guide.composed.furthest } : {}),
        ...(guide.rendering ? { rendering: guide.rendering } : {}),
      })
    }
    offset += length
  }

  return {
    version: sessionVersion,
    song: song.number,
    mood: mood.descriptions,
    mode: mood.character.mode,
    tempo: mood.character.tempo,
    ...(mood.character.sound ? { sound: mood.character.sound } : {}),
    choir: introduce(choir),
    ...(thought ? { thought } : {}),
    ...(first.rate ? { rate: first.rate } : {}),
    ...(first.perspectives?.length
      ? {
          perspectives: first.perspectives.map(({ slug, title, facet, variant }) => ({
            slug,
            title,
            facet,
            ...(variant ? { variant } : {}),
          })),
        }
      : {}),
    singers: choir.map(({ body, harmony }) => ({ body, harmony })),
    ...(throat ? { throat } : {}),
    seconds: seconds(offset),
    iterations,
    recordings,
    ...(guides.length ? { guides } : {}),
  }
}
