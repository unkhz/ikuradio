// Written over the guide (plan "The two-voice guide", step 4): the order a
// song is made in turns over. The words are fitted to their bars first,
// rhythm only; the guide is composed from that rhythm, section by section,
// its chords where the words lean; and only then does the lead get its
// pitches, written over the guide by the writer, every line, every
// iteration anew. The tune the Song remembers gives the words their bars and
// the bridge its journey. The melody is not remembered: it is written again
// from the chords each time, and last iteration's line only pulls at its
// contour, so it drifts instead of jumping.

import type { UsedProgression } from './progression.js'
import {
  composeGuide,
  degreeToMidi,
  modes,
  standing,
  vocalRange,
  wrongness,
  writeOverGuide,
  type Key,
  type Score,
  type Singer,
  type Syllables,
  type TimedSyllable,
  type TwoVoiceGuide,
} from 'melody'

/** A line written over its section's guide. */
export type Written = {
  /** The section's name, `verse:1`: where in the iteration the guide was composed. */
  section: string
  guide: TwoVoiceGuide
  /** The lead's pitches, one a syllable, in degrees of the Song's key. */
  degrees: number[]
  /** How many of its standing syllables there were, and how many stood on a tone of the guide's chord. */
  standing: number
  onChord: number
  /** The most syllables in a row it sang on one pitch. */
  run: number
  /** What its section's chords were chosen by. */
  progression?: UsedProgression
}

/** A line fitted to its bars, before it has pitches of its own: the lead's score, and its words' stresses. */
export type Fitted = { score: Score; words?: readonly Syllables[] }

/** The degrees a lead may be written in: the compass a verse keeps, within what the body reaches. */
export function compass(key: Key, body: Singer): [number, number] {
  const [lowest, highest] = vocalRange[body]
  const inRange = Array.from({ length: 15 }, (_, k) => k - 5).filter((d) => {
    const midi = degreeToMidi(d, key)
    return midi >= lowest && midi <= highest
  })
  return [inRange[0] ?? -5, inRange.at(-1) ?? 9]
}

/**
 * A line's timed syllables, from its fitted score: each sounding note a
 * syllable, at `offset` beats into its section, counted at `bpm`. Words
 * whose stress is unknown, or a hum, stand only where they are long.
 */
export function timedLine({ score, words }: Fitted, offset: number, bpm: number): TimedSyllable[] {
  const marks = words?.flatMap((word) =>
    word.stresses.map((stress, i) => ({ stress, begins: i === 0, comma: i === word.stresses.length - 1 && Boolean(word.comma) })),
  )
  const own: TimedSyllable[] = []
  let at = offset
  for (const [midi, beats] of score.notes) {
    const b = (beats * bpm) / score.bpm
    if (midi > 0) own.push({ at, beats: b, ...(marks?.[own.length] ?? { stress: 0, begins: true, comma: false }), lineEnd: false })
    at += b
  }
  if (own.length) own[own.length - 1]!.lineEnd = true
  return own
}

/** How long a fitted line lasts, in beats at `bpm`. */
const beatsOf = ({ score }: Fitted, bpm: number) => score.notes.reduce((sum, [, b]) => sum + (b * bpm) / score.bpm, 0)

/** The longest run of one pitch in a row. */
export function longestRun(degrees: readonly number[]) {
  let run = 0
  let longest = 0
  for (const [i, d] of degrees.entries()) {
    run = i > 0 && d === degrees[i - 1] ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  return longest
}

const cls = (d: number) => ((d % 7) + 7) % 7

/** How many standing syllables there are, and how many stand on a tone of the chord sounding under them. */
export function standingOnChord(syllables: readonly TimedSyllable[], degrees: readonly number[], guide: TwoVoiceGuide) {
  let all = 0
  let on = 0
  for (const [i, s] of syllables.entries()) {
    if (!standing(s)) continue
    all++
    const chord = guide.chords.findLast((c) => c.at <= s.at + 1e-9) ?? guide.chords[0]!
    if ([0, 2, 4].some((k) => cls(chord.root + k) === cls(degrees[i]!))) on++
  }
  return { standing: all, onChord: on }
}

/** A section to be written: its name, how it ends, and its lines, each by its key, fitted. */
export type Unwritten = {
  name: string
  ending: 'half' | 'full'
  lines: { key: string; index: number; fitted: Fitted }[]
  /** Which chords its guide takes: roaming, unless its part's progression says otherwise. */
  progression?: UsedProgression
}

/**
 * Every line of an iteration's sections written over its section's guide:
 * the guide composed from the section's fitted rhythm, seeded by its place
 * in the Song and pulled toward the guide the same section had an iteration
 * ago, and each line's pitches by the writer, seeded by the line's place
 * and words, so a line sung twice in an iteration is sung the same. Two
 * sections with the same lines and the same ending share one guide. A line
 * already written, in an earlier section, keeps what it was written.
 */
export function writeSections({
  sections,
  iteration,
  mode,
  bpm,
  lead,
  before = new Map(),
  sprinkle,
  pull,
}: {
  sections: readonly Unwritten[]
  iteration: bigint
  mode: keyof typeof modes
  bpm: number
  /** The lead's key and body: what the writer's degrees sound as. */
  lead: { key: Key; body: Singer }
  /** What was written an iteration ago, by section name and line index, `verse:1:2`. */
  before?: ReadonlyMap<string, Written>
  sprinkle: number
  pull: number
}): Map<string, Written> {
  const [low, high] = compass(lead.key, lead.body)
  const semitones = (a: number, b: number) => Math.abs(degreeToMidi(a, lead.key) - degreeToMidi(b, lead.key))
  const written = new Map<string, Written>()
  const shared = new Map<string, TwoVoiceGuide>()
  for (const { name, ending, lines, progression } of sections) {
    const timed: TimedSyllable[][] = []
    let beats = 0
    for (const { fitted } of lines) {
      timed.push(timedLine(fitted, beats, bpm))
      beats += beatsOf(fitted, bpm)
    }
    const same = `${ending}|${JSON.stringify(progression ?? null)}|${lines.map(({ key }) => key).join('|')}`
    const guide =
      shared.get(same) ??
      composeGuide({
        syllables: timed.flat(),
        beats,
        bpm,
        mode: modes[mode],
        ending,
        random: wrongness(`guide:${iteration}:${name}`),
        previous: [...before.values()].find((w) => w.section === name)?.guide,
        progression,
      })
    shared.set(same, guide)
    let from: number | undefined
    for (const [i, { key, index }] of lines.entries()) {
      const already = written.get(key)
      if (already || !timed[i]!.length) {
        from = already?.degrees.at(-1) ?? from
        continue
      }
      const degrees = writeOverGuide({
        syllables: timed[i]!,
        guide,
        low,
        high,
        random: wrongness(`melody:${iteration}:${key}`),
        semitones,
        from,
        closes: i === lines.length - 1,
        previous: before.get(`${name}:${index}`)?.degrees,
        sprinkle,
        pull,
      })
      written.set(key, {
        section: name,
        guide,
        degrees,
        ...standingOnChord(timed[i]!, degrees, guide),
        run: longestRun(degrees),
        ...(progression ? { progression } : {}),
      })
      from = degrees.at(-1)
    }
  }
  return written
}

/** A score given the writer's pitches, one a sounding note, in the lead's key; unchanged if they do not match its notes. */
export function sungAs(score: Score, degrees: readonly number[], key: Key): Score {
  if (score.notes.filter(([midi]) => midi > 0).length !== degrees.length) return score
  let k = 0
  return { ...score, notes: score.notes.map(([midi, beats]): [number, number] => [midi > 0 ? degreeToMidi(degrees[k++]!, key) : midi, beats]) }
}
