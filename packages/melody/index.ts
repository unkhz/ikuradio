import { fitPhrase, fitToCount, growOnReciting, shortestBeats, spacing, type Phrase, type Syllables } from './lib/fit.js'
import { chorusHook, verseWalk } from './lib/hooks.js'
import {
  aeolian,
  degreeToMidi,
  modes,
  type Key,
  type ModeName,
} from './lib/scale.js'

import { firstTune, type Tune } from './lib/variation.js'
import { slowSection } from './lib/guide.js'
import { bridgeForm, journey } from './lib/bridge.js'

export { fitPhrase, chorusHook, verseWalk, aeolian, modes, degreeToMidi }
export { firstTune, evolve, step, variations, type Development } from './lib/variation.js'
export type { Tune } from './lib/variation.js'
export { wrongness } from './lib/wrongness.js'
export { guideStep, slowPhrase, slowSection } from './lib/guide.js'
export { bridgeForm, journey, walkingDistance, type BridgeForm, type Pitches } from './lib/bridge.js'
export { atonal, pitchNames, rowName, toneRow } from './lib/atonal.js'
export {
  changePoints,
  chordLengths,
  chordPath,
  composeGuide,
  counterpoint,
  guideCosts,
  timedLine,
  type ChordFunction,
  type Ending,
  type GuideChord,
  type TimedSyllable,
  type TwoVoiceGuide,
} from './lib/guide.js'
export { degreeOf, nearestDegree, vocalRange } from './lib/reach.js'
export { unfamiliarVerse } from './lib/writer.js'
export {
  harmonizeChoir,
  parallel,
  sidesOf,
  traditional,
  voiceLine,
  type ChordSource,
  type Harmony,
} from './lib/harmony.js'
export type { Phrase, Key, ModeName }
export type { Note } from './lib/fit.js'
export {
  fitBars,
  fitToCount,
  growOnReciting,
  mostSyllables,
  paceOf,
  recitingOf,
  shortestBeats,
  spacing,
  strength,
  type Fit,
  type Syllables,
} from './lib/fit.js'

export type Singer = 'male' | 'female' | 'child'

/** One line, written to the note, in the language Chimera reads. */
export type Score = {
  bpm: number
  lyrics: string
  /** [midi, beats]; a midi of 0 is silence. */
  notes: [number, number][]
}

/** What a Mood tells the tune: which mode to sing in, and how fast. */
export type Character = {
  mode: ModeName
  /** Beats per minute. */
  tempo: number
  /**
   * What the music under the voice sounds like, in a musician's words: its
   * instruments and its style. Missing in characters heard before the mind
   * was asked, and then the Music hears the Mood's own words.
   */
  sound?: string
  /**
   * Who the mind heard leading the singing in this Mood, and how the choir
   * sings: soft and breathy, plain, or pressed and clear. Missing in
   * characters heard before the mind was asked, and then the choir is
   * gathered by chance alone.
   */
  voice?: { lead: Singer; breath: Breath }
}

/** How a choir sings: soft and breathy, plain, or pressed and clear. */
export type Breath = 'soft' | 'plain' | 'pressed'

/** The character the song was born with: A minor, slow enough to be mournful, quick enough to keep walking. */
export const firstCharacter: Character = { mode: 'aeolian', tempo: 76 }

/** Every singer sings on A, each in their own octave, in the mode the Mood chose. */
export function keyFor(singer: Singer, mode: ModeName = 'aeolian'): Key {
  return { tonic: singer === 'male' ? 45 : 57, mode: modes[mode] }
}

export type LineOptions = {
  part: 'verse' | 'chorus'
  /** Which line of the part, from 0. Lines past the hook wrap around. */
  line: number
  lyrics: string
  syllables: number
  singer: Singer
  character?: Character
  /**
   * How many scale steps below (negative) or above the tune this voice sings.
   * -2 is a third below, -4 a fifth below: the choir stays in the mode, so
   * its thirds are major or minor wherever the scale says they are.
   */
  harmony?: number
  /** The tune to sing, if not the one the song was born with. */
  tune?: Tune
  /** How many syllables a second the voice may sing at most; the line is fitted to the grid that allows. */
  rate?: number
  /**
   * The line's words, with each syllable's stress, as many syllables as
   * `syllables`: with a rate, the line is fitted bar by bar, stressed
   * syllables on the strong beats.
   */
  words?: readonly Syllables[]
}

/** Sets one line of lyrics to its tune, for one voice. */
export function setLine({
  part,
  line,
  lyrics,
  syllables,
  singer,
  character = firstCharacter,
  harmony = 0,
  tune = firstTune,
  rate,
  words,
}: LineOptions): Score {
  const phrases = part === 'chorus' ? tune.chorus : tune.verse
  const phrase = phrases[line % phrases.length]
  const least = rate ? shortestBeats(character.tempo, rate) : undefined
  const counted = words?.reduce((sum, word) => sum + word.stresses.length, 0)
  // the line that carries the number grows on its reciting note; the tune it
  // is read from may be an old copy, so the mark is read from the hook itself
  const reciting = part === 'chorus' ? chorusHook[line % chorusHook.length]?.reciting : undefined
  const k = rate ? spacing(character.tempo, rate) : 1
  let fitted: Phrase | undefined
  if (rate && words && counted === syllables) {
    if (reciting !== undefined) fitted = growOnReciting({ ...phrase, reciting }, words, k)
    else {
      // a line written to its count: its own bars, or one of grace, and never more
      fitted = fitToCount(phrase, words, k)?.phrase
      if (!fitted) throw new NoRoom(`"${lyrics}" does not fit its bars, even with one more`)
    }
  }
  const { notes, rest } = fitted ?? fitPhrase(phrase, syllables, least)
  const key = keyFor(singer, character.mode)
  return {
    bpm: character.tempo,
    lyrics,
    notes: [
      ...notes.map(([degree, beats]): [number, number] => [
        degreeToMidi(degree + harmony, key),
        beats,
      ]),
      [0, rest],
    ],
  }
}

/** A line whose words do not fit its bars, even with a bar of grace: it was not written to its count, and is not sung. */
export class NoRoom extends Error {}

/** How many beats a bridge lasts: four bars. */
export const bridgeBeats = 16

/**
 * The hum of a bridge, for one voice, from part `from` to part `to`: a
 * farewell to the part that has just ended, in its key; the head of the
 * part to come, foreshadowed away from where it begins and then nearer; and
 * a lead-in that stops a step short of its first note, for it to resolve.
 * Or, in an odd `song` where the two parts lie far apart, an echo of the
 * part that ended and a long walk to the coming part's first note.
 * Every part of a Song is in the Song's key today; if a part ever has a key
 * of its own, the bridge already leads from one to the other. `lyrics` is
 * what is hummed, one sound for each note.
 */
export function setBridge({
  from,
  to,
  lyrics,
  singer,
  character = firstCharacter,
  harmony = 0,
  tune = firstTune,
  beats = bridgeBeats,
  song,
}: {
  from: 'verse' | 'chorus'
  to: 'verse' | 'chorus'
  lyrics: (notes: number) => string
  singer: Singer
  character?: Character
  harmony?: number
  tune?: Tune
  beats?: number
  /** The Song the bridge is in, which decides whether it walks. */
  song?: string | bigint
}): Score {
  const phrases = (part: 'verse' | 'chorus') => (part === 'chorus' ? tune.chorus : tune.verse)
  const key = keyFor(singer, character.mode)
  const leaving = phrases(from).at(-1)!
  const coming = phrases(to)[0]
  const notes = journey({
    from: leaving,
    fromKey: key,
    to: coming,
    toKey: key,
    beats,
    harmony,
    form: bridgeForm(song, leaving, coming),
  })
  return { bpm: character.tempo, lyrics: lyrics(notes.length), notes }
}

/** A score with its last note held `beats` longer: a tail, for the Music to carry on into. */
export function holdLast(score: Score, beats: number): Score {
  if (beats <= 0 || score.notes.length === 0) return score
  const notes = score.notes.map(([midi, b]): [number, number] => [midi, b])
  notes[notes.length - 1][1] += beats
  return { ...score, notes }
}

/** The phrase a line of a part is sung to: lines past the hook wrap around. */
export function phraseOf(tune: Tune, part: 'verse' | 'chorus', line: number): Phrase {
  const phrases = part === 'chorus' ? tune.chorus : tune.verse
  return phrases[line % phrases.length]
}

/**
 * The guide hum of a section, for one voice: its lines' phrases slowed to
 * their skeleton, each lasting as long as its line, in the singer's key.
 * `lyrics` is what is hummed, one sound for each note.
 */
export function setGuide({
  lines,
  lyrics,
  singer,
  character = firstCharacter,
  harmony = 0,
}: {
  lines: { phrase: Phrase; beats: number }[]
  lyrics: (notes: number) => string
  singer: Singer
  character?: Character
  harmony?: number
}): Score {
  const key = keyFor(singer, character.mode)
  const notes = slowSection(lines)
  return {
    bpm: character.tempo,
    lyrics: lyrics(notes.length),
    notes: notes.map(([degree, beats]): [number, number] => [
      degreeToMidi(degree + harmony, key),
      beats,
    ]),
  }
}

/** How long a line takes, rest included, in seconds. */
export function scoreSeconds(score: Score): number {
  const beats = score.notes.reduce((sum, [, b]) => sum + b, 0)
  return (beats * 60) / score.bpm
}
