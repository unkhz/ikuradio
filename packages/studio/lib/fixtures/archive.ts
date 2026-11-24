// An iteration's worth of what the Studio made, drawn from a Session in the Archive (read, never written): the lines at their moments, the voices recorded for them,
// the beds under the sections and the guides hummed. A Session keeps what was decided, and not the sound, nor what the typing was decided from; so what is not in it is
// given a plain stand-in (a take is one note, a line is voiced for most of its seconds), the same to everything that reads it. What matters is where things lie.

import { firstTune } from 'melody'
import { arrange, firstLyrics, type Lyrics } from 'song'
import { firstChoir, type Take } from 'vocals'
import { defaults } from 'perspectives'
import type { Session } from 'archive'
import type { Iteration } from '../compose.js'
import type { Guide } from '../guide.js'
import type { SungLine } from '../perform.js'
import type { Made } from '../session.js'

const take = (lyrics: string): Take => ({ bpm: 76, lyrics, notes: [[57, 1]], t0: 0.1, vibrato: 0 })

/** Which Lyrics field a place of the Song as it always was sings: arrange() gives each its words. */
const fieldAt = (() => {
  const named = Object.fromEntries((Object.keys(firstLyrics) as (keyof Lyrics)[]).map((field) => [field, field])) as Lyrics
  return arrange(named).map((part) => (part.content ? (part.content as keyof Lyrics) : undefined))
})()

/** The names of an iteration's regions in the Song as it always was, in order: the key of what lies under one is its Track, its name and, from the second iteration, its number. */
const regionNames = ['verse-1', 'bridge-1', 'chorus', 'bridge-2', 'verse-2', 'bridge-3', 'chorus', 'bridge-4', 'verse-3', 'final-chorus']
const keyOfRegion = (track: string, region: number, iteration: number) => `${track}:${regionNames[region]}${iteration > 0 ? `:${iteration + 1}` : ''}`

/** The iterations of a Session as the Studio made them. */
export function madeFromSession(session: Session): Made[] {
  const first = BigInt(session.iterations[0]!.iteration)
  return session.iterations.map((one, i): Made => {
    const end = one.at + one.seconds
    const lyrics = {} as Record<string, string>
    const lines: SungLine[] = []
    for (const [index, part] of one.parts.entries()) {
      const field = fieldAt[index]
      if (field && !lyrics[field]) lyrics[field] = part.lines.map((line) => line.text).join('\n')
      const placed = part.type === 'bridge' ? [{ text: '', at: part.at }] : part.lines.map((line) => ({ text: line.text, at: line.at }))
      placed.forEach((line, n) => {
        const sung = part.lines[n]
        const voices = session.recordings
          .filter((recording) => recording.kind === 'voice' && Math.abs(recording.at - line.at) < 1e-3)
          .map((recording) => ({ file: recording.id, voice: recording.voice ?? 0, gain: recording.gain ?? 1, take: take(line.text) }))
        lines.push({
          part: part.type,
          index: part.type === 'bridge' ? index : n,
          lyrics: line.text,
          file: '',
          voices,
          recordings: [],
          // a line lasts until the next begins, rest included: the last, until the iteration ends
          seconds: 0,
          enters: 0.3,
          voiced: 0,
          at: line.at - one.at,
          ...(part.type === 'bridge' && voices.length === 0 ? { unheard: true } : {}),
          ...(sung?.grown ? { grown: sung.grown } : {}),
          ...(sung?.quickest !== undefined ? { quickest: sung.quickest } : {}),
        })
      })
    }
    lines.forEach((line, n) => {
      const next = lines[n + 1]
      line.seconds = (next ? next.at : one.seconds) - line.at
    })
    // the same words are sung once and placed again, so a line has the same length wherever it is: as the Studio has it, to the last digit (a Session keeps thousandths, and
    // each place of the chorus has its own rounding). The moments are then laid again end to end from the lengths, as the Studio lays them.
    const partOf = new Map<number, number>()
    let cursor = 0
    const lineStart: number[] = []
    for (const [index, part] of one.parts.entries()) {
      lineStart.push(cursor)
      cursor += part.type === 'bridge' ? 1 : part.lines.length
      const field = fieldAt[index]
      const earlier = field === undefined ? -1 : fieldAt.slice(0, index).indexOf(field)
      if (earlier >= 0) partOf.set(index, earlier)
    }
    for (const [index, earlier] of partOf) {
      const count = one.parts[index]!.lines.length
      for (let n = 0; n < count; n++) lines[lineStart[index]! + n]!.seconds = lines[lineStart[earlier]! + n]!.seconds
    }
    let at = 0
    for (const line of lines) {
      line.at = at
      line.voiced = Math.max(0.1, line.seconds * 0.8)
      at += line.seconds
    }
    const sectionAt = one.parts.map((part) => part.at - one.at)
    const derived = one.parts.map((_, index) => {
      const first = lines[lineStart[index]!]!
      const last = lines[(lineStart[index + 1] ?? lines.length) - 1]!
      return { at: first.at, seconds: last.at + last.seconds - first.at }
    })
    /** The section a moment of the Session was under, as the lines were laid again. */
    const sectionOf = (moment: number) => {
      const k = sectionAt.findIndex((begin) => Math.abs(begin - moment) < 1e-6)
      return k < 0 ? undefined : derived[k]
    }
    const regionOf = (moment: number) => sectionAt.findIndex((begin) => Math.abs(begin - moment) < 1e-6)
    const composed: Iteration = {
      iteration: BigInt(one.iteration),
      mood: { descriptions: session.mood, character: { mode: session.mode as never, tempo: session.tempo, ...(session.sound ? { sound: session.sound } : {}) } },
      choir: firstChoir,
      tune: firstTune,
      variation: one.variation,
      sung: firstTune,
      beginsSong: i === 0,
      song: { number: session.song, began: `${first}`, lasts: one.of.of },
      lyrics: { ...firstLyrics, ...lyrics } as Lyrics,
      perspectives: (session.perspectives ?? []).map(({ slug, title, facet, variant }) => ({ slug, title, facet: facet as never, ...(variant ? { variant } : {}) })),
      settings: defaults(session.singers.length),
      rate: session.rate ?? 6,
      ...(one.tides ? { tides: one.tides.map((tide) => ({ ...tide, facet: 'melody', part: 'verse', setting: 'ceiling', cycle: 0, age: 1 })) as never } : {}),
    }
    const guides: Guide[] = (session.guides ?? [])
      .filter((guide) => guide.at >= one.at - 1e-6 && guide.at < end - 1e-6)
      .map((guide) => ({
        key: keyOfRegion('guide', regionOf(guide.at - one.at), i),
        kind: (guide.from && guide.to ? `bridge:${guide.from}>${guide.to}` : guide.part) as never,
        part: guide.part,
        at: sectionOf(guide.at - one.at)?.at ?? guide.at - one.at,
        seconds: sectionOf(guide.at - one.at)?.seconds ?? guide.seconds,
        file: guide.id,
        score: guide.score,
        take: take('ooh'),
        ...(guide.lower ? { lower: { take: take('ooh'), body: guide.lower.body } } : {}),
        ...(guide.chords ? { composed: { chords: guide.chords, furthest: guide.furthest } as never } : {}),
        ...(guide.rendering ? { rendering: guide.rendering } : {}),
        ...(guide.melody ? { melody: guide.melody } : {}),
        ...(guide.progression ? { progression: { style: guide.progression.style, temperature: guide.progression.temperature, pull: guide.progression.pull, ...(guide.progression.from ? { known: { from: guide.progression.from, roots: guide.progression.roots } } : {}), ...(guide.progression.unfound ? { unfound: guide.progression.unfound } : {}) } as never } : {}),
      }))
    return {
      composed,
      lines,
      beds: session.recordings
        .filter((recording) => recording.kind === 'bed' && recording.at >= one.at - 1e-6 && recording.at < end - 1e-6)
        .map((recording) => ({ key: keyOfRegion('bed', regionOf(recording.at - one.at), i), file: recording.id, at: sectionOf(recording.at - one.at)?.at ?? recording.at - one.at, gain: recording.gain, seconds: sectionOf(recording.at - one.at)?.seconds ?? recording.seconds, fade: recording.fade })),
      guides,
    }
  })
}
