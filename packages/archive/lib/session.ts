// The Session: the complete declaration of a Song, as the Studio leaves it in
// the Archive. Everything a Receiver needs to play the Song is here: what it
// is, every Recording and the moment it begins, and every character of every
// line and the moment it is typed. A Receiver that has the Session, the
// Recordings and the Tactus needs nothing else, and can play the Song from
// any moment in it.
//
// All moments are in seconds from the beginning of the Song.

export const sessionVersion = 1

export type Session = {
  version: typeof sessionVersion
  /** Which Song this is, counted from 0. */
  song: string
  /** The weather it is sung in. */
  mood: string[]
  mode: string
  tempo: number
  /** The band the mind heard in the Mood, if it heard one. */
  sound?: string
  /** Who sings it, for anyone watching. */
  choir: string
  /** How long the whole Song lasts. */
  seconds: number
  iterations: SessionIteration[]
  /** Everything audible, each at its moment. */
  recordings: SessionRecording[]
}

export type SessionIteration = {
  /** Which iteration this is, counted from 0. */
  iteration: string
  /** When it begins. */
  at: number
  seconds: number
  variation: number
  /** Where in its Song it stands, counted from one. */
  of: { at: number; of: number }
  parts: SessionPart[]
}

export type SessionPart = {
  type: 'verse' | 'chorus' | 'bridge'
  at: number
  seconds: number
  /** The words, a line at a time. A bridge has none. */
  lines: SessionLine[]
}

export type SessionLine = {
  text: string
  /** When the line's place in the music begins. */
  at: number
  /**
   * When each character is typed, in milliseconds from `at`; one more than
   * there are characters, the last being the line's end.
   */
  typing: number[]
}

export type SessionRecording = {
  /** Its name in the Archive's recordings: its content, as a hash. */
  id: string
  at: number
  /** How loud it is played, 1 being as recorded. */
  gain?: number
  kind: 'voice' | 'bed'
  /** How long its place in the Song lasts, if the Studio knows: a Receiver arriving later need not fetch it. */
  seconds?: number
}

/** What the Archive holds: the Songs it has, oldest first. */
export type ArchiveIndex = {
  songs: string[]
}

/** Where things are, inside an Archive. */
export const paths = {
  index: 'index.json',
  session: (song: string) => `sessions/${song}.json`,
  recording: (id: string) => `recordings/${id}`,
}
