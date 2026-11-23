// The benches (plan "Evolution of Song", step 15): for the concepts that are made by the mind and the band and not kept, a place to change what goes in and
// see what comes out. Nothing on a bench is saved, and nothing here is a rule of its own: each bench is the Learn page's own answer, asked for other
// inputs, so that at the sample values it is exactly that page's drawing. The server runs no MusicGen and asks no mind.

import { degreeToMidi, firstTune, keyFor, modes, pitchNames, spacing, type ModeName } from 'melody'
import type { PartRecord } from 'parts'
import { ageLine, bedsAnswer, fittedLine, songAnswer, syllablesOf, tuneAnswer, wordsOf } from './making.js'
import { moodAnswer } from './shaping.js'

type Input = Record<string, unknown>
export type Bench = { refusal: string } | Record<string, unknown>

const number = (value: unknown, fallback: number, least: number, most: number) => {
  const asked = Number(value)
  return Number.isFinite(asked) ? Math.min(most, Math.max(least, asked)) : fallback
}

/** Every bench there is, by the concept it belongs to: what it is asked, and the answer the Learn page of that concept would draw for it. */
export const benches: Record<string, (input: Input, context: { records: readonly PartRecord[]; arrangementsDir: string; tempo: number }) => Promise<Bench> | Bench> = {
  // the weather picked, and the mode and tempo heard in it: the tempo settles, since it may not leap
  mood: (input) => {
    const descriptions = Array.isArray(input.descriptions) ? input.descriptions.filter((one): one is string => typeof one === 'string').slice(0, 8) : undefined
    const mode = typeof input.mode === 'string' && input.mode in modes ? input.mode : undefined
    const tempo = input.tempo === undefined ? undefined : number(input.tempo, 76, 1, 400)
    const answer = moodAnswer({ ...(descriptions ? { descriptions } : {}), ...(mode ? { mode } : {}), ...(tempo !== undefined ? { tempo } : {}) })
    return { ...answer, bench: { asked: tempo ?? answer.born.tempo, settled: answer.born.tempo } }
  },

  // the tune evolved so many Songs, each phrase's notes named in the mode chosen
  tune: (input) => {
    const songs = Math.floor(number(input.songs, 6, 0, 40))
    const mode = (typeof input.mode === 'string' && input.mode in modes ? input.mode : 'aeolian') as ModeName
    const answer = tuneAnswer({ songs })
    const key = keyFor('female', mode)
    const last = answer.evolution.at(-1)!.tunes
    const names = Object.fromEntries(Object.entries(last).map(([part, phrases]) => [part, phrases.map((phrase) => phrase.notes.map(([degree]) => pitchNames[degreeToMidi(degree, key) % 12]))]))
    return { ...answer, bench: { songs, mode, names } }
  },

  // a line typed for a phrase of the tune, fitted as the Score would set it; or the Song's age, as it would be at an iteration
  score: async (input, { tempo }) => {
    const rate = 6
    if (input.iteration !== undefined) return ageLine(Math.floor(number(input.iteration, 1, 1, 1e9)), spacing(tempo, rate))
    const index = Math.floor(number(input.index, 0, 0, firstTune.verse.length - 1))
    return fittedLine(firstTune.verse[index]!, typeof input.text === 'string' ? input.text.slice(0, 400) : '', number(input.tempo, tempo, 20, 300), rate)
  },

  // a line typed for a part's line, against how many syllables the part would ask of it at a wordiness
  lyrics: async (input, { records, tempo }) => {
    const record = records.find(({ part }) => part.id === input.part && part.words === 'written')
    if (!record) return { refusal: `there is no part "${String(input.part)}" that has words` }
    const line = Math.floor(number(input.line, 0, 0, 3))
    const wordiness = number(input.wordiness, 0.5, 0, 1)
    const count = { wordiness, ...record.part.measure({ line, tune: firstTune, tempo: number(input.tempo, tempo, 20, 300), rate: 6, parameters: { wordiness } }) }
    const text = typeof input.text === 'string' ? input.text.slice(0, 400) : ''
    const words = text ? await wordsOf(text) : []
    return { count, typed: { text, syllables: syllablesOf(words), rough: words.some((word) => word.rough), words } }
  },

  // the guide a part's lines would make, for the band to be asked: no band is asked here
  beds: (input, { records, arrangementsDir, tempo }) => bedsAnswer(records, arrangementsDir, number(input.tempo, tempo, 20, 300), typeof input.part === 'string' ? input.part : undefined),

  // an Arrangement laid out as the Session it would make
  song: (input, { records, arrangementsDir, tempo }) => songAnswer(records, arrangementsDir, number(input.tempo, tempo, 20, 300), typeof input.arrangement === 'string' ? input.arrangement : undefined),
}

