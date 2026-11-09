import { fitPhrase, type Phrase } from './lib/fit.js'
import { chorusHook, verseWalk } from './lib/hooks.js'
import { aeolian, degreeToMidi, type Key } from './lib/scale.js'

export { fitPhrase, chorusHook, verseWalk, aeolian, degreeToMidi }
export type { Phrase, Key }
export type { Note } from './lib/fit.js'

export type Singer = 'male' | 'female' | 'child'

/** One line, written to the note, in the language Chimera reads. */
export type Score = {
  bpm: number
  lyrics: string
  /** [midi, beats]; a midi of 0 is silence. */
  notes: [number, number][]
}

/** Slow enough to be mournful, quick enough to keep walking. */
export const tempo = 76

/** Every singer sings in A minor, each in their own octave. */
export function keyFor(singer: Singer): Key {
  return { tonic: singer === 'male' ? 45 : 57, mode: aeolian }
}

export type LineOptions = {
  part: 'verse' | 'chorus'
  /** Which line of the part, from 0. Lines past the hook wrap around. */
  line: number
  lyrics: string
  syllables: number
  singer: Singer
}

/** Sets one line of lyrics to its tune. */
export function setLine({
  part,
  line,
  lyrics,
  syllables,
  singer,
}: LineOptions): Score {
  const tune = part === 'chorus' ? chorusHook : verseWalk
  const { notes, rest } = fitPhrase(tune[line % tune.length], syllables)
  const key = keyFor(singer)
  return {
    bpm: tempo,
    lyrics,
    notes: [
      ...notes.map(([degree, beats]): [number, number] => [
        degreeToMidi(degree, key),
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
