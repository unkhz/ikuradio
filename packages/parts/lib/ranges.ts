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

/** What a Block may be given: a gain, and a fade in and a fade out in seconds, each within the most the Track allows. */
export const blockParameters = ({ gain = 2, fade = 10 }: { gain?: number; fade?: number } = {}) => ({
  gain: Type.Number({ minimum: 0, maximum: gain, default: 1, description: 'How loud the Block is: 1 as it is made' }),
  fadeIn: Type.Number({ minimum: 0, maximum: fade, default: 0, description: 'Seconds it takes to rise from nothing' }),
  fadeOut: Type.Number({ minimum: 0, maximum: fade, default: 0, description: 'Seconds it takes to fall to nothing, at its end' }),
})
