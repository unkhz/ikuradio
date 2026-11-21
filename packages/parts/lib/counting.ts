// How the parts with words count a line: the phrase's own notes, and the most
// the phrase can carry at this tempo and rate, moved by the part's wordiness.

import { mostSyllables, spacing, type Phrase } from 'melody'
import { wordyCount } from 'song'
import type { LineMeasure } from './part.js'

/** The phrase's own count, as the song always wrote a line: its notes, and the most they can carry. */
export const countOf = (phrase: Phrase, tempo: number, rate: number): { target: number; most: number } => ({
  target: phrase.notes.length,
  most: mostSyllables(phrase, spacing(tempo, rate)),
})

/** The count at a wordiness: 0.5 is the song as it always was, toward 0 fewer, toward 1 more. A line within its bars does not grow. */
export const wordyMeasure = (phrase: Phrase, tempo: number, rate: number, wordiness: number): LineMeasure => ({
  ...wordyCount(countOf(phrase, tempo, rate), wordiness),
  grows: false,
})
