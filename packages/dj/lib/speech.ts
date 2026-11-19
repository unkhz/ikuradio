// A DJ speaks as a voice sings: a take, notes and words, as the throat is
// given them. It is speech, not a tune: every syllable is a note, its pitch
// leans where the syllable is stressed, a phrase rises as it begins and
// falls as it ends, and a comma is a breath. The words are the mind's; their
// syllables and stress come from the throat's dictionary, given here.

import type { Dj } from './dj.js'

/** One word, with the stress of each syllable (1 main, 2 lesser, 0 none), and whether a comma or stop follows it. */
export type Spoken = { text: string; stresses: number[]; comma: boolean }

/** What is said, as the Archive keeps it: the notes in MIDI and beats at `bpm`, a rest being 0, and the words. Nothing of the voice. */
export type Speech = {
  bpm: number
  lyrics: string
  notes: [number, number][]
}

/** Seconds of breath a DJ takes before the first note. */
export const breath = 0.1

/** What the throat is given: the speech, with the DJ's voice put to it. The Archive never holds this. */
export type Take = Speech & {
  t0: number
  vibrato: number
  pressure: number
  tension: number
  breathiness: number
}

/** A speech with a DJ's voice, ready for the throat. */
export const taken = (dj: Dj, speech: Speech): Take => ({
  ...speech,
  t0: breath,
  vibrato: dj.voice.vibrato,
  pressure: dj.voice.pressure,
  tension: dj.voice.tension,
  breathiness: dj.voice.breathiness,
})

/** The beats a second takes: speech is counted at 120 bpm, two beats to the second. */
export const speechBpm = 120

/** The shortest a syllable may last, in seconds: the throat does not hurry. */
export const shortest = 0.17

/** A word's syllables, guessed from its letters when the dictionary does not know it: a vowel group each. */
export function guessed(text: string): number[] {
  const groups = text.toLowerCase().replace(/e$/, '').match(/[aeiouy]+/g)?.length ?? 1
  return Array.from({ length: Math.max(1, groups) }, (_, i) => (i === 0 && groups > 1 ? 1 : 0))
}

/** Words as spoken: the text of `lyrics`, each with its stresses, from `stresses` or guessed. */
export function spokenOf(lyrics: string, stresses: ReadonlyMap<string, number[]>): Spoken[] {
  return lyrics
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => {
      const text = token.toLowerCase().replace(/[^a-z']/g, '')
      if (!text) return []
      return [{ text, stresses: stresses.get(text) ?? guessed(text), comma: /[,.;:!?—–]$/.test(token) }]
    })
}

/**
 * The speech of `words` in `seconds`, fitted: as many of the words as the
 * throat may say in that time at the DJ's pace, never hurried past
 * `shortest` a syllable, and always whole phrases: a speech does not stop
 * in the middle of a word, and the words are kept in the order they come. Nothing, if not even the first word fits.
 */
export function speak(dj: Dj, words: readonly Spoken[], seconds: number): Speech | undefined {
  const { voice } = dj
  const room = seconds - breath
  // the lengths each syllable asks for, in the share of the room it takes: stressed ones linger
  const weight = (stress: number) => (stress === 1 ? 1.35 : stress === 2 ? 1 : 0.75)
  const used: Spoken[] = []
  let total = 0
  const cost = (word: Spoken) => word.stresses.reduce((sum, s) => sum + weight(s), 0) + (word.comma ? voice.pause : 0)
  for (const word of words) {
    const next = total + cost(word)
    // the unit a syllable of weight 1 lasts, if all of `used` plus this word are said in the room
    if ((room / next) * 0.75 < shortest) break
    used.push(word)
    total = next
  }
  const kept = used
  if (!kept.length) return undefined
  // the pace the voice keeps, unless the room is smaller; a speech never fills more than it needs
  const unit = Math.min(1 / voice.pace, room / total)
  const notes: [number, number][] = []
  const lyrics: string[] = []
  // phrases, to give each its arc
  const phrases: Spoken[][] = [[]]
  for (const word of kept) {
    phrases.at(-1)!.push(word)
    if (word.comma) phrases.push([])
  }
  const sounding = phrases.filter((p) => p.length)
  const syllablesOf = (phrase: Spoken[]) => phrase.reduce((sum, w) => sum + w.stresses.length, 0)
  for (const [p, phrase] of sounding.entries()) {
    const last = p === sounding.length - 1
    const n = syllablesOf(phrase)
    let k = 0
    for (const word of phrase) {
      lyrics.push(word.text)
      for (const stress of word.stresses) {
        // a phrase rises as it begins and settles by its end; the last settles furthest: serene
        const along = n <= 1 ? 0 : k / (n - 1)
        const shape = voice.arc * (1 - 2 * along) * (last ? 1.4 : 1)
        const midi = voice.pitch + shape + (stress === 1 ? voice.lift : stress === 2 ? voice.lift / 2 : 0)
        notes.push([Math.round(midi * 100) / 100, Math.round(weight(stress) * unit * speechBpm / 60 * 1000) / 1000])
        k++
      }
    }
    const comma = phrase.at(-1)?.comma
    if (comma && p < sounding.length - 1) notes.push([0, Math.round(voice.pause * unit * speechBpm / 60 * 1000) / 1000])
  }
  return {
    bpm: speechBpm,
    lyrics: lyrics.join(' '),
    notes,
  }
}

/** How long a speech lasts, in seconds, its breath before the first note counted. */
export const lasts = (speech: Pick<Speech, 'bpm' | 'notes'>) =>
  breath + (speech.notes.reduce((sum, [, beats]) => sum + beats, 0) * 60) / speech.bpm
