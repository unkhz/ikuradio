import { fitPhrase, type Phrase } from './lib/fit.js'
import { chorusHook, verseWalk } from './lib/hooks.js'
import {
  aeolian,
  degreeToMidi,
  modes,
  type Key,
  type ModeName,
} from './lib/scale.js'

export { fitPhrase, chorusHook, verseWalk, aeolian, modes, degreeToMidi }
export type { Phrase, Key, ModeName }
export type { Note } from './lib/fit.js'

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
}

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
}: LineOptions): Score {
  const tune = part === 'chorus' ? chorusHook : verseWalk
  const { notes, rest } = fitPhrase(tune[line % tune.length], syllables)
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

/** How long a line takes, rest included, in seconds. */
export function scoreSeconds(score: Score): number {
  const beats = score.notes.reduce((sum, [, b]) => sum + b, 0)
  return (beats * 60) / score.bpm
}
