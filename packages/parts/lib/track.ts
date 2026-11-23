// A Track (plan "Evolution of Song", step 8): a lane of the timeline, one for each kind of thing that sounds, and the one thing
// every lane is. Voice, bed and guide are subclasses of it, each in a folder of its own under `tracks/`, and whatever takes a Track
// takes any of them. A Track declares what its Blocks are made from and by what, whether they are heard, and what a Block on it
// may be given (its gain and its fades). A Track that nothing makes yet may be declared and drawn, and says it makes nothing.

import type { TSchema } from 'typebox'

/** What makes a Track's Blocks, and from what. */
export type Making = {
  /** What makes them, in words: the throat, MusicGen, a hum. */
  by: string
  /** What they are made from, in words: a Score, a guide. */
  from: string
}

export abstract class Track {
  /** Its name, the folder's: never reused, and never removed once a Song has been made with it. */
  abstract readonly id: string
  /** Whether what is on it sounds: a Track whose Blocks are only made, never heard, is not. */
  abstract readonly heard: boolean
  /** What makes its Blocks, and from what; nothing, for a Track that nothing makes yet (a drum Track, before an instrument that can play a whole Song). */
  readonly makes?: Making
  /** What a Block on it may be given, as a TypeBox schema: its gain and its fades, with their ranges. */
  abstract readonly parameters: TSchema
}
