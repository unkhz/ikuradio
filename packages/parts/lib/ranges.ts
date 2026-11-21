// The numbers a part may be given, and what each can be: the ranges the
// Tides and the Perspectives move them within, kept here by the parts.

import { Type, type TNumber } from 'typebox'

/** How wordy a part's lines are, from 0, sparse, to 1, as full as the phrase can carry; 0.5 is the song as it always was. */
export const wordiness = (): TNumber => Type.Number({ minimum: 0, maximum: 1, default: 0.5, description: 'How wordy the lines are: 0.5 is the song as it always was' })

/** How high and how far a part's melody goes: the usual melody is the weightiest word two steps below the top, nothing narrowing or stilling it. */
export const melody = () => ({
  ceiling: Type.Number({ minimum: 0, maximum: 14, default: 2, description: 'Steps below the top of the voice that the weightiest word stands' }),
  span: Type.Number({ minimum: 0, maximum: 10, default: 0, description: 'How far the melody is narrowed' }),
  travel: Type.Number({ minimum: 0, maximum: 10, default: 0, description: 'How far the melody is stilled' }),
})
