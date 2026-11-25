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

/** Declarative browser-side Web Audio mixing sends and tone shaping available on every heard Track. */
export const mixParameters = () => ({
  reverb: Type.Number({ minimum: 0, maximum: 1, default: 0, description: 'Stereo hall reverb send (0 dry, 1 cavernous wash that rings across silences)' }),
  echo: Type.Number({ minimum: 0, maximum: 1, default: 0, description: 'Warm tempo-synced stereo dub echo send (0 dry, 1 deep repeating trail)' }),
  echoBeats: Type.Number({ minimum: 0.25, maximum: 2, default: 0.75, description: 'Echo delay length in beats (e.g. 0.5 eighth, 0.75 dotted eighth, 1.5 dotted quarter)' }),
  filter: Type.Number({ minimum: 0, maximum: 1, default: 1, description: 'Low-pass warmth filter (1 fully open, 0 muffled underwater haze)' }),
  pan: Type.Number({ minimum: -1, maximum: 1, default: 0, description: 'Stereo placement (-1 left, 0 center, 1 right)' }),
})

/** What a Block may be given: a gain, fades, and optional browser-side spatial/tone mixing controls. */
export const blockParameters = ({ gain = 2, fade = 10 }: { gain?: number; fade?: number } = {}) => ({
  gain: Type.Number({ minimum: 0, maximum: gain, default: 1, description: 'How loud the Block is: 1 as it is made' }),
  fadeIn: Type.Number({ minimum: 0, maximum: fade, default: 0, description: 'Seconds it takes to rise from nothing' }),
  fadeOut: Type.Number({ minimum: 0, maximum: fade, default: 0, description: 'Seconds it takes to fall to nothing, at its end' }),
  ...mixParameters(),
})
