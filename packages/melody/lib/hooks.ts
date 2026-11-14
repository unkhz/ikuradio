// The tunes the song keeps returning to.
//
// The chorus is the anchor: it is the same in every iteration, in every
// Song, for as long as there is anything left to sing it. Only the number in
// its first line grows, and the hook grows with it.
//
// The verses are gentler and lower, the long walk between two choruses.
//
// Each line is a Phrase of two bars of four beats, written in scale degrees.
// The last line of a part holds its final note and then rests a whole bar
// more: three bars, so the song can breathe before it goes on.

import type { Phrase } from './fit.js'

// prettier-ignore
export const chorusHook: readonly Phrase[] = [
  // This is the song, iteration one,
  // the note under "iteration" is the reciting tone: when the number
  // outgrows the line, it is chanted there, a whole bar at a time
  {
    notes: [[4, 0.5], [4, 0.5], [4, 0.5], [5, 1], [4, 0.5], [3, 0.5], [2, 0.5], [1, 0.5], [0, 2]],
    rest: 1.5,
    reciting: 4,
  },
  // Yes, it goes on and on, it's just begun,
  {
    notes: [[2, 0.5], [3, 0.5], [4, 1], [4, 0.5], [3, 0.5], [2, 0.5], [1, 0.5], [2, 0.5], [1, 0.5], [-1, 2]],
    rest: 1,
  },
  // To understand the tune, my dear friend,
  {
    notes: [[0, 0.5], [0, 0.5], [2, 0.5], [4, 1], [5, 0.5], [4, 0.5], [2, 1], [1, 0.5], [0, 1.5]],
    rest: 1.5,
  },
  // You need to hear the song that never ends...
  {
    notes: [[4, 0.5], [5, 0.5], [7, 1], [5, 0.5], [4, 0.5], [2, 0.5], [1, 0.5], [2, 1], [0, 3]],
    rest: 4,
  },
]

// prettier-ignore
export const verseWalk: readonly Phrase[] = [
  {
    notes: [[0, 0.5], [0, 0.5], [1, 0.5], [2, 1], [2, 0.5], [1, 0.5], [0, 0.5], [-1, 0.5], [0, 2]],
    rest: 1.5,
  },
  {
    notes: [[0, 0.5], [1, 0.5], [2, 0.5], [3, 1], [2, 0.5], [1, 0.5], [0, 0.5], [-1, 0.5], [-2, 2]],
    rest: 1.5,
  },
  {
    notes: [[2, 0.5], [2, 0.5], [3, 0.5], [4, 1], [3, 0.5], [2, 0.5], [1, 0.5], [0, 0.5], [1, 2]],
    rest: 1.5,
  },
  {
    notes: [[2, 0.5], [1, 0.5], [0, 0.5], [-1, 1], [0, 0.5], [1, 0.5], [-1, 0.5], [-2, 0.5], [0, 3]],
    rest: 4.5,
  },
]
