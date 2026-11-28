// The guide hums: for every bed the Music grows, the lead hums its melody
// slowly, the same tempo with fewer notes, for the Music to follow. A guide
// for a verse or the chorus is that part's lines slowed to their skeleton.
// A guide for a bridge is the bridge's own journey, from the last notes of
// the part it leaves to the first note of the part it leads to. Every guide
// lasts as long as its section and the tail after it, holding its last
// note, so the Music has a voice to follow while it fades. A guide is never
// heard by anyone: it is what the Music listened to, and the Archive keeps
// it as that, with its score. A bridge heard from a Perspective that takes
// its key away is hummed in a row of all twelve pitches instead, to the same
// rhythm: the Music only ever grows from what it hears.
//
// The two-voice guide (plan "The two-voice guide") hums every section, not
// only the first of each kind: its own chords, composed from its own words,
// in two voices. The lead hums the upper voice, a slow melody; the choir's
// lowest body that reaches it hums the lower, the roots and the bass line.
// Both hum in the Song's key, on A. Each section's bed then grows from its
// own guide.
//
// Why taking turns. MusicGen hears a guide as one pitch class at a time,
// the loudest in each eighth of a second, and nothing else (its feature
// extractor keeps only the argmax of a chromagram). Hummed by the upper
// voice alone, as the guide was before, it heard the chord's root in 31% of
// the chords. With both voices sounding together it heard 59%, with the
// lower louder 83%, and with the lower voice opening each chord and the
// upper finishing it, one at a time, 94%, and 99% of what it heard was a
// chord tone, the most of any rendering. The beds grown from the guide in
// turns lie a little closer to its chords than those grown from the upper
// voice alone: 68% of their pitch energy on the chord tones against 65%,
// with 43% by chance (measured on ten sections, beds grown for four, same
// prompt and seed; thoughts/robot/2026-11.md, "What the band can hear").
// The balance turning between two voices that both sound did as well on
// the root and a little worse on chord tones, and needs a gain that moves;
// taking turns needs nothing but rests. The scientist's ear chose taking
// turns, and with it the melody written over the guide (./written.ts): a
// section's guide is composed before its lines are sung, from their fitted
// rhythm, and hummed here from what was composed.

import {
  atonal,
  composeGuide,
  holdLast,
  inTurnsPitches,
  modes,
  phraseOf,
  setBridge,
  setGuide,
  vocalRange,
  wrongness,
  type Key,
  type MidiTurn,
  type Phrase,
  type Score,
  type Singer,
  type Syllables,
  type TimedSyllable,
  type TwoVoiceGuide,
} from 'melody'
import { createHash } from 'node:crypto'
import { sections, tail, type Kind, type Section } from 'music'
import { makeOnce, mixdown, record, throatScore, vocalsDir, type Take, type Throat } from 'vocals'
import type { Iteration } from './compose.js'
import { hum, type SungLine } from './perform.js'
import { stressedLine } from './stressed.js'
import type { Written } from './written.js'
import { progressionOf, type UsedProgression } from './progression.js'

/**
 * Whether each section's guide is the two-voice guide, hummed in turns, the
 * lead's melody written over it, and each section grows its own bed from it.
 * Off, the lead sings its tune, and the Music grows a bed for the first
 * section of each kind from the lead's slow reading of its melody.
 */
export const twoVoices = true

export type Guide = {
  /** The key of the timeline's guide Block it was hummed for: one guide for each key, placed wherever the timeline places it. */
  key?: string
  /** The kind of bed it guided. */
  kind: Kind
  part: string
  /** The section it was hummed for, from the start of the iteration. */
  at: number
  /** How long the section lasts; the guide goes on through the tail after it. */
  seconds: number
  file: string
  /** What the lead hummed: the guide's notes, in MIDI and beats, at its tempo. */
  score: Pick<Score, 'bpm' | 'notes'>
  /** What the lead hummed, exactly as the throat was given it: the source the guide is kept as. */
  take: Take
  /** For a two-voice guide: which section of the iteration it was hummed for, from 0, and its name, `verse:1`. */
  section?: number
  name?: string
  /** For a two-voice guide: the lower voice, as its throat was given it, and the body that hummed it. */
  lower?: { take: Take; body: Singer }
  /** For a two-voice guide: what was composed, its chords explicit, in degrees of the Song's key. */
  composed?: TwoVoiceGuide
  /** How the voices were hummed for the Music. */
  rendering?: 'turns'
  /** For a section whose melody was written over its guide: the share of standing syllables on a chord tone, and the most syllables in a row on one pitch. */
  melody?: { onChord: number; run: number }
  /** For a two-voice guide: what its chords were chosen by, roaming or known, and the roots a known one took. */
  progression?: UsedProgression
}

/** A guide the timeline asks for: its key, which section of the iteration it is hummed for, and its tempo (`null` for free time). */
export type GuideAsked = { key: string; section: number; bpm?: number | null }

/** Clean pitch-accurate throat for guides: keeps breath/tension, strips roughness/fry/tract colouration so MusicGen hears pure pitches. */
function guideThroat(throat?: Throat): Pick<Throat, 'pressure' | 'tension' | 'breathiness'> | undefined {
  if (!throat) return undefined
  return { pressure: throat.pressure, tension: throat.tension, breathiness: throat.breathiness }
}

/**
 * Hums the guides an iteration's timeline asks for: one for each key, the sections the Music grows its beds from. A guide the lead cannot hum
 * is left out, and the Music listens to the sung voice instead. Without two voices, a guide is hummed for the first section of each kind of bed, as it always was.
 */
export async function humGuides(
  iteration: Iteration,
  lines: SungLine[],
  previous: readonly Guide[] = [],
  asked: readonly GuideAsked[] = [],
): Promise<Guide[]> {
  if (twoVoices) return humTwoVoices(iteration, lines, previous, asked)
  const { mood, choir, sung: tune, song, settings } = iteration
  const [lead] = choir
  const all = sections(lines)
  const first = all.filter((s, i) => all.findIndex((t) => t.kind === s.kind) === i)
  const beatsOf = (seconds: number) => (seconds * mood.character.tempo) / 60
  const voice = { singer: lead.body, character: mood.character, harmony: lead.harmony }
  const guides = await Promise.all(
    first.map(async (section): Promise<Guide | undefined> => {
      const score =
        section.part === 'bridge'
          ? // a bridge's guide is its journey, from the part it leaves to the one it leads to
            setBridge({
              from: section.from ?? 'verse',
              to: section.to ?? 'chorus',
              lyrics: hum,
              tune,
              song: song.number,
              beats: beatsOf(section.seconds),
              ...voice,
            })
          : setGuide({
              lines: section.lines.map((line) => ({
                phrase: phraseOf(tune, line.part as 'verse' | 'chorus', line.index) as Phrase,
                beats: beatsOf(line.seconds),
              })),
              lyrics: hum,
              ...voice,
            })
      // a bridge that has lost its key is hummed in the Song's row instead, to the same rhythm
      const { row } = settings['bridge-beds']
      const keyed = section.part === 'bridge' && row ? atonal(score, row) : score
      const held = holdLast(keyed, beatsOf(tail))
      try {
        // steady, without a singer's wavering: it is a map, not a performance
        const take: Take = { ...held, t0: 0.05, vibrato: 0, drift: 0, ...guideThroat(lead.throat) }
        const file = await record(take, lead.body)
        return {
          kind: section.kind,
          part: section.part,
          at: section.at,
          seconds: section.seconds,
          file,
          score: { bpm: held.bpm, notes: held.notes },
          take: throatScore(take),
        }
      } catch (error) {
        console.warn(`the lead could not hum the guide for the ${section.kind}: ${error}`)
        return undefined
      }
    }),
  )
  return guides.filter((guide) => guide !== undefined)
}

/** The key every guide is hummed in: the Song's, on A, the octave the lead hums in. */
const keyOf = (mode: Iteration['mood']['character']['mode']): Key => ({ tonic: 57, mode: modes[mode] })

/**
 * The timed syllables of a section, from what its lead sang: each sounding
 * note a syllable, with the stress the throat's dictionary gives its word.
 * A line whose words cannot be told apart that way lends no syllables, and
 * the guide changes chord less there.
 */
export async function syllablesOf(
  section: Section<SungLine>,
  bpm: number,
  stressed: (line: string, syllables: number) => Promise<Syllables[] | undefined> = stressedLine,
): Promise<TimedSyllable[]> {
  const syllables: TimedSyllable[] = []
  for (const line of section.lines) {
    const lead = line.voices.find(({ voice }) => voice === 0) ?? line.voices[0]
    if (!lead || line.unheard || line.part === 'bridge' || line.words === 'none' || line.words === 'silent' || line.words === 'spoken' || !line.lyrics.trim()) continue
    const { take } = lead
    const sounding = take.notes.filter(([midi]) => midi > 0).length
    const words = await stressed(line.lyrics, sounding).catch(() => undefined)
    if (!words) continue
    const marks = words.flatMap((word) =>
      word.stresses.map((stress, i) => ({ stress, begins: i === 0, comma: i === word.stresses.length - 1 && Boolean(word.comma) })),
    )
    let at = ((line.at - section.at + take.t0) * bpm) / 60
    const own: TimedSyllable[] = []
    for (const [midi, beats] of take.notes) {
      // the take keeps its own tempo; the guide counts in the Song's
      const b = (beats * bpm) / take.bpm
      if (midi > 0 && marks[own.length]) own.push({ at, beats: b, ...marks[own.length]!, lineEnd: false })
      at += b
    }
    if (own.length) own[own.length - 1]!.lineEnd = true
    syllables.push(...own)
  }
  return syllables
}

/** How far above the bottom of its reach a body must hum the lower voice: near the bottom a voice is mostly overtones, and the Music hears those instead. */
export const roomBelow = 7

/** The bodies from the lowest reach up. */
const lowestFirst: Singer[] = ['male', 'female', 'child']

/**
 * Who hums the lower voice: the choir's lowest body that reaches its lowest
 * note, or the male throat when no one in the choir does.
 */
export function lowerVoice(choir: Iteration['choir'], lowest: number): { body: Singer; throat?: Throat } {
  for (const body of lowestFirst) {
    const member = choir.find((voice) => voice.body === body)
    if (member && vocalRange[body][0] + roomBelow <= lowest) return { body, throat: member.throat }
  }
  return { body: 'male' }
}

/** A row turned upside down about its first pitch: the lower voice's row under the upper's. */
export const inversion = (row: readonly number[]) => row.map((pitch) => (((2 * row[0]! - pitch) % 12) + 12) % 12)

/** A voice in MIDI and beats, a rest being 0, folded by octaves into what `body` reaches. */
function voiceOfMidi(turns: readonly MidiTurn[], body: Singer): [number, number][] {
  const [low, high] = vocalRange[body]
  return turns.map(([raw, beats]): [number, number] => {
    if (raw === null) return [0, beats]
    let midi = raw
    while (midi < low) midi += 12
    while (midi > high) midi -= 12
    return [midi, beats]
  })
}

/** Folds a score into a body's reach, by octaves: an atonal row may lean below it. */
function within(score: Score, body: Singer): Score {
  const [low, high] = vocalRange[body]
  return {
    ...score,
    notes: score.notes.map(([midi, beats]): [number, number] => {
      if (midi === 0) return [0, beats]
      let m = midi
      while (m < low) m += 12
      while (m > high) m -= 12
      return [m, beats]
    }),
  }
}

/**
 * The two-voice guide of every section of an iteration, hummed in turns
 * and mixed into the one recording the Music listens to. Each section's
 * guide is composed from its own words, seeded by its place in the Song,
 * and pulled gently toward the guide the same section had an iteration
 * ago. A section the voices cannot hum is left out, and its bed grows as
 * the old guide would have it.
 */
export async function humTwoVoices({ mood, choir, settings, iteration, song }: Iteration, lines: SungLine[], previous: readonly Guide[], asked: readonly GuideAsked[]): Promise<Guide[]> {
  const bpm = mood.character.tempo
  const key = keyOf(mood.character.mode)
  const [lead] = choir
  const all = sections(lines)
  const counted = new Map<string, number>()
  const named = all.map((section) => {
    const n = counted.get(section.part) ?? 0
    counted.set(section.part, n + 1)
    return `${section.part}:${n}`
  })
  const { row } = settings['bridge-beds']
  const guides = await Promise.all(
    asked.map(async ({ key: asking, section: i, bpm: askedBpm }): Promise<Guide | undefined> => {
      const section = all[i]
      if (!section) {
        console.warn(`${asking} is hummed for section ${i + 1}, which this iteration was not sung with`)
        return undefined
      }
      // a section under its own tempo hums its guide at that tempo; free time uses the Mood's bpm internally to express its seconds
      const sectionBpm = typeof askedBpm === 'number' ? askedBpm : bpm
      const written = section.lines.flatMap((line) => (line.written ? [line.written] : []))
      const name = written[0]?.section ?? named[i]!
      const progressionSetting =
        settings.progression[section.part as 'verse' | 'chorus' | 'bridge'] ?? settings.progression.verse
      const nextMusical = all.slice(i + 1).find((s) => s.part !== 'silence' && s.part !== 'spoken')
      const nextProg = nextMusical
        ? (settings.progression[nextMusical.part as 'verse' | 'chorus' | 'bridge'] ?? settings.progression.verse)
        : undefined
      const sectionEnding = section.part === 'chorus' || section.part === 'refrain' || section.part === 'outro' || i === all.length - 1 ? 'full' : 'half'
      const nextShift = nextProg ? (nextProg.shift ?? 0) : undefined
      const progression =
        written[0]?.progression ??
        (await progressionOf(progressionSetting, { part: section.part, place: Number(named[i]!.split(':')[1]), song: song.number }))
      // a section whose melody was written over its guide hums that guide; any other composes its own
      // (and if a half-ending section flows into a differently shifted key, pivots its final chord for MusicGen!)
      const composed = written[0]?.guide ?? composeGuide({
        syllables: await syllablesOf(section, sectionBpm),
        beats: (section.seconds * sectionBpm) / 60,
        bpm: sectionBpm,
        mode: key.mode,
        ending: sectionEnding,
        random: wrongness(`guide:${iteration}:${name}`),
        previous: previous.find((guide) => guide.name === name)?.composed,
        progression,
        ...(sectionEnding === 'half' && nextShift !== undefined && nextShift !== (progressionSetting.shift ?? 0) ? { nextShift } : {}),
      })
      const turns = inTurnsPitches(composed, key, sectionBpm)
      const lowest = Math.min(...turns.lower.flatMap(([m]) => (m === null ? [] : [m])))
      const low = lowerVoice(choir, lowest)
      let upper: Score = { bpm: sectionBpm, lyrics: '', notes: voiceOfMidi(turns.upper, lead.body) }
      let lower: Score = { bpm: sectionBpm, lyrics: '', notes: voiceOfMidi(turns.lower, low.body) }
      // a bridge that has lost its key: the upper voice hums the row, the lower its inversion
      if (section.part === 'bridge' && row) {
        upper = within(atonal(upper, row), lead.body)
        lower = within(atonal(lower, inversion(row)), low.body)
      }
      const sung = (score: Score, throat?: Throat): Take => {
        const held = holdLast(score, (tail * sectionBpm) / 60)
        // steady, without a singer's wavering: it is a map, not a performance
        return { ...held, lyrics: hum(held.notes.filter(([m]) => m > 0).length), t0: 0.05, vibrato: 0, drift: 0, ...guideThroat(throat) }
      }
      const upperTake = sung(upper, lead.throat)
      const lowerTake = sung(lower, low.throat)
      try {
        const [high, deep] = await Promise.all([record(upperTake, lead.body), record(lowerTake, low.body)])
        // two sections that share a guide hum it at the same moment: it is mixed once, and read only whole
        const file = await makeOnce(`${vocalsDir}/${createHash('sha256').update(JSON.stringify({ high, deep })).digest('hex')}.m4a`, (partial) =>
          mixdown([{ file: high, at: 0 }, { file: deep, at: 0 }], partial),
        )
        return {
          key: asking,
          kind: section.kind,
          part: section.part,
          at: section.at,
          seconds: section.seconds,
          file,
          score: { bpm: sectionBpm, notes: upperTake.notes },
          take: throatScore(upperTake),
          section: i,
          name,
          lower: { take: throatScore(lowerTake), body: low.body },
          composed,
          rendering: 'turns',
          ...(written.length ? { melody: melodyOf(written) } : {}),
          progression,
        }
      } catch (error) {
        console.warn(`the voices could not hum the guide for ${name}: ${error}`)
        return undefined
      }
    }),
  )
  return guides.filter((guide) => guide !== undefined)
}

/** How a section's written melody kept the writer's rules: the share of its standing syllables on a chord tone, and its longest run on one pitch. */
export function melodyOf(written: readonly Written[]) {
  const standing = written.reduce((sum, w) => sum + w.standing, 0)
  const onChord = written.reduce((sum, w) => sum + w.onChord, 0)
  return { onChord: standing ? Math.round((onChord / standing) * 1000) / 1000 : 1, run: Math.max(...written.map((w) => w.run)) }
}

/** What the Music is given to listen to: a two-voice guide by its key, an old one by its kind. */
export const guidesFor = (hummed: readonly Guide[]): Map<Kind | number, string> =>
  new Map(hummed.map((guide) => [guide.section ?? guide.kind, guide.file]))
