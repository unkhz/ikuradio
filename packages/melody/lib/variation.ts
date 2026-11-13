// The tune is allowed to change, but only the way a path changes: a step
// at a time, by those who walk it.
//
// A Tune is the chorus and the verses, written in scale degrees. The chorus
// is the anchor and never moves. The verses walk. When a new Song begins,
// every verse phrase takes one small step from where the last Song left it:
// one inner note moves to its neighbour in the scale, or two inner notes
// trade their lengths. The first note and the last, the departure and the
// cadence, never move, and the bar lines never move.
//
// Within a Song, a few Variations take turns: the Song's tune, and the same
// tune with one ornament more. They are small, and they do not add up.
// What adds up is the step from one Song to the next. After a thousand
// Songs, the verses may be somewhere nobody has heard. Each one will still
// sound like the one before.

import type { Note, Phrase } from './fit.js'
import { chorusHook, verseWalk } from './hooks.js'
import { wrongness } from './wrongness.js'

export type Tune = {
  chorus: Phrase[]
  verse: Phrase[]
}

/** The tune the song was born with. */
export const firstTune: Tune = {
  chorus: chorusHook.map(copy),
  verse: verseWalk.map(copy),
}

function copy(phrase: Phrase): Phrase {
  return {
    notes: phrase.notes.map(([d, b]): Note => [d, b]),
    rest: phrase.rest,
  }
}

/** The walking range of the verses, in scale degrees: low enough to mourn, high enough to hope. */
const lowest = -3
const highest = 7
/** No inner note may end up further than this from its neighbours, in scale degrees. */
const widestLeap = 4

/** One small step for one phrase. Returns the phrase unchanged if no step is possible. */
export function step(phrase: Phrase, random: () => number): Phrase {
  const notes = phrase.notes.map(([d, b]): [number, number] => [d, b])
  const inner = notes.length - 2
  if (inner < 1) return copy(phrase)

  // a few tries to find a step that the phrase can take gracefully
  for (let attempt = 0; attempt < 8; attempt++) {
    const i = 1 + Math.floor(random() * inner)
    if (random() < 0.75) {
      // a note moves to its neighbour in the scale
      const degree = notes[i][0] + (random() < 0.5 ? -1 : 1)
      const graceful =
        degree >= lowest &&
        degree <= highest &&
        Math.abs(degree - notes[i - 1][0]) <= widestLeap &&
        Math.abs(degree - notes[i + 1][0]) <= widestLeap
      if (graceful) {
        notes[i][0] = degree
        return { notes, rest: phrase.rest }
      }
    } else if (i + 1 < notes.length - 1 && notes[i][1] !== notes[i + 1][1]) {
      // two inner neighbours trade their lengths, and the bar stays whole
      const length = notes[i][1]
      notes[i][1] = notes[i + 1][1]
      notes[i + 1][1] = length
      return { notes, rest: phrase.rest }
    }
  }
  return copy(phrase)
}

/** The tune of the next Song: every verse phrase takes one step. The chorus stays. */
export function evolve(tune: Tune, name: string): Tune {
  const random = wrongness(`evolve:${name}`)
  return {
    chorus: tune.chorus.map(copy),
    verse: tune.verse.map((phrase) => step(phrase, random)),
  }
}

/** How far a Song's Variations move from its tune: how many verse phrases are ornamented, and by how many steps. */
export type Development = { ornaments: number; steps: number }

/**
 * The Variations of a Song's tune. The first is the tune itself. Each of the
 * others has its ornaments: by default a single verse phrase, chosen by its
 * name, takes one step; a Song's development may ornament more phrases, or
 * further. Every variation is made from the Song's tune, never from another
 * variation, so they do not add up.
 */
export function variations(
  tune: Tune,
  count: number,
  name: string,
  { ornaments = 1, steps = 1 }: Partial<Development> = {},
): Tune[] {
  return Array.from({ length: Math.max(1, count) }, (_, v) => {
    if (v === 0)
      return { chorus: tune.chorus.map(copy), verse: tune.verse.map(copy) }
    const random = wrongness(`variation:${name}:${v}`)
    // the first ornament is chosen as it always was, so a plain Song sounds as before
    const ornamented = new Set<number>()
    const phrases = Math.min(Math.max(1, ornaments), tune.verse.length)
    while (ornamented.size < phrases) ornamented.add(Math.floor(random() * tune.verse.length))
    return {
      chorus: tune.chorus.map(copy),
      verse: tune.verse.map((phrase, p) => {
        if (!ornamented.has(p)) return copy(phrase)
        let walked = phrase
        for (let s = 0; s < Math.max(1, steps); s++) walked = step(walked, random)
        return walked
      }),
    }
  })
}
