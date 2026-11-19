// A DJ is not part of a Song. A DJ lives on the page and introduces a Song
// that someone has come to (plan "Intro with Rezzy"). What a DJ is like is
// the same for every Song, so it is kept here, loaded once, and is not
// written into the Archive. The Archive keeps only what a DJ says in a Song.

/** How a DJ's voice is given to the throat, whatever they say. */
export type Voice = {
  /** The throat's body: `child` for a small critter. */
  body: 'male' | 'female' | 'child'
  /** The MIDI note the voice rests on, in speech. */
  pitch: number
  /** How far a stressed syllable leans above it, in semitones. */
  lift: number
  /** How far a phrase rises at its beginning and falls by its end, in semitones: enthusiasm, then serenity. */
  arc: number
  /** Syllables a second, when a stressed one and an unstressed one are averaged. */
  pace: number
  /** Seconds of rest at a comma, as a share of a syllable. */
  pause: number
  /** Lung pressure, in cmH2O. */
  pressure: number
  /** 0 slack … 1 pressed. */
  tension: number
  /** 0 clear … 1 all breath. */
  breathiness: number
  /** Vibrato depth in cents. */
  vibrato: number
}

/** How a DJ's body is moved by what they say. */
export type Movements = {
  /** How wide the mouth opens on a syllable, 0 to 1, at most. */
  mouth: number
  /** How far the body bobs on a syllable that rises, 0 to 1, at most. */
  bob: number
  /** Seconds a movement lasts at least: nothing flickers. */
  least: number
}

export type Dj = {
  /** The DJ's name in the Archive: `dj-<name>-<song>.json`. */
  name: string
  title: string
  /** Who the DJ is, for the mind that writes what they say. */
  persona: string
  voice: Voice
  movements: Movements
}
