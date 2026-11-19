// A DJ is not part of a Song. A DJ lives on the page and introduces a Song
// that someone has come to (plan "Intro with Rezzy"). What a DJ is like is
// the same for every Song, so it is kept here, loaded once, and is not
// written into the Archive. The Archive keeps only what a DJ says in a Song.
// A DJ speaks with Chimera's Speak mode, the speaking throat, which is not
// the throat the choir sings with.

/** How a DJ's voice is given to the speaking throat, whatever they say. */
export type Voice = {
  /**
   * The throat's body: a name, or a mix of the three, as Chimera's bodies
   * blend, `{ female: 0..1, child: 0..1 }`, male being neither.
   */
  body: 'male' | 'female' | 'child' | { female: number; child: number }
  /** The baseline pitch in Hz: Chimera speaks a male at 112, a female at 205, a child at 250. */
  f0: number
  /** The speaking rate, a multiplier: 1 as Chimera speaks. */
  rate: number
  /** How far stressed syllables lean, a fraction: Chimera leans 0.14. */
  accent?: number
  /** The throat, when it is not Chimera's own: lung pressure in cmH2O, 0 slack … 1 pressed, 0 clear … 1 all breath. */
  pressure?: number
  tension?: number
  breathiness?: number
}

/** How a DJ's body is moved by what they say. */
export type Movements = {
  /** How wide the mouth opens on an open vowel, 0 to 1, at most. */
  mouth: number
  /** How far the body bobs on a stressed vowel, 0 to 1, at most. */
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
