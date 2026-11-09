// Words never come in the length a tune was written for. A phrase must make
// room for every syllable it is handed, and give back the room it does not
// need, without forgetting its shape.
//
// Fitting is deterministic. The same words always meet the same tune in the
// same way, so a line that returns sounds like itself.

/** One note of a phrase: a scale degree, and its length in beats. */
export type Note = readonly [degree: number, beats: number]

export type Phrase = {
  notes: readonly Note[]
  /** Silence after the last note, in beats. Breath before the next line. */
  rest: number
}

/** Below this length a note is not split any further; the phrase slows down instead. */
const shortest = 0.25

/**
 * Bends a phrase to carry exactly `syllables` sung notes.
 *
 * Too many notes: the shortest inner note is folded into the note before it.
 * Too few: the longest note before the cadence is split in two, repeated in
 * place, the way a chant repeats a pitch to make room for more words. When
 * the notes are already as short as they may be, the whole phrase is
 * stretched to twice its length, so that a line which keeps growing (the
 * spelled-out iteration number does) is sung slower and longer, never
 * gabbled.
 *
 * The first note and the last note, the departure and the cadence, are never
 * removed and never split.
 */
export function fitPhrase(phrase: Phrase, syllables: number): Phrase {
  if (!Number.isInteger(syllables) || syllables < 1) {
    throw new Error(`a phrase cannot carry ${syllables} syllables`)
  }
  let notes: Note[] = [...phrase.notes]
  let rest = phrase.rest

  while (notes.length > syllables) {
    notes = foldShortest(notes)
  }

  while (notes.length < syllables) {
    const split = splitLongest(notes)
    if (split) {
      notes = split
    } else {
      notes = notes.map(([degree, beats]) => [degree, beats * 2])
      rest *= 2
    }
  }

  return { notes, rest }
}

function foldShortest(notes: Note[]): Note[] {
  if (notes.length === 2) {
    return [[notes[0][0], notes[0][1] + notes[1][1]]]
  }
  let pick = 1
  for (let i = 2; i < notes.length - 1; i++) {
    if (notes[i][1] < notes[pick][1]) pick = i
  }
  const folded = [...notes]
  const [, beats] = folded.splice(pick, 1)[0]
  const [degree, before] = folded[pick - 1]
  folded[pick - 1] = [degree, before + beats]
  return folded
}

function splitLongest(notes: Note[]): Note[] | undefined {
  // a lone note is its own cadence, and is allowed to split
  const last = notes.length === 1 ? 1 : notes.length - 1
  let pick = -1
  for (let i = 0; i < last; i++) {
    if (
      notes[i][1] >= shortest * 2 &&
      (pick < 0 || notes[i][1] > notes[pick][1])
    ) {
      pick = i
    }
  }
  if (pick < 0) return undefined
  const [degree, beats] = notes[pick]
  const split = [...notes]
  split.splice(pick, 1, [degree, beats / 2], [degree, beats / 2])
  return split
}
