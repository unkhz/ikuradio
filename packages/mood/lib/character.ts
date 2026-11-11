// A Mood is only words. The mind listens to the words and tells the tune
// what it hears: a mode, and a tempo.
//
// The tempo is not allowed to leap. Whatever the mind hears, the song moves
// at most a few beats per minute from where it was, the way a walker changes
// pace, not the way a radio changes station.

import { modes, type Character, type ModeName } from 'melody'
import { ask } from 'tools'

const slowest = 56
const fastest = 132
/** How far the tempo may move between two Songs, in beats per minute. */
const stride = 16

const schema = {
  type: 'object',
  properties: {
    mode: { type: 'string', enum: Object.keys(modes) },
    tempo: { type: 'integer', minimum: slowest, maximum: fastest },
    sound: { type: 'string', minLength: 8, maxLength: 90 },
  },
  required: ['mode', 'tempo', 'sound'],
}

const instruction = `You are the ear of a song that never ends. You are given the mood of the song: a few words, blended. Decide how the song's melody should sound in that mood.

Choose a mode:
- ionian: major, plain daylight
- dorian: minor with a raised sixth, hopeful sorrow, folk and jazz
- phrygian: minor with a lowered second, dark, ancient, Spanish
- lydian: major with a raised fourth, floating, dreamlike
- mixolydian: major with a lowered seventh, rock, funk, open roads
- aeolian: natural minor, sad and steady
- harmonic: harmonic minor, longing, the old world, the desert

Choose a tempo in beats per minute, between ${slowest} and ${fastest}.

Describe the sound of the band that plays under the voice in that mood, in a few words, the way a musician would say it to the band: its instruments and its style, for example "slow string quartet with a cello drone" or "dusty desert blues guitar and hand drums". The mood may be a feeling, a place or a picture; say how it sounds. Do not mention singing, a voice or words.`

/** Keeps a tempo within reach of the previous one, and within what a throat can sing. */
export function settle(tempo: number, previous: number): number {
  const reachable = Math.min(
    previous + stride,
    Math.max(previous - stride, tempo),
  )
  return Math.round(Math.min(fastest, Math.max(slowest, reachable)))
}

/**
 * Asks the mind what a Mood sounds like. If the mind does not answer, or
 * answers with something that is not a mode, the song keeps the character it
 * had: the words change, the tune waits.
 */
export async function hear(
  descriptions: readonly string[],
  previous: Character,
): Promise<Character> {
  try {
    const answer = await ask<{ mode?: string; tempo?: number; sound?: string }>({
      instruction,
      input: descriptions.join(' + '),
      schema,
      temperature: 0.7,
    })
    if (!answer?.mode || !(answer.mode in modes)) return previous
    const tempo = Number.isFinite(answer.tempo)
      ? settle(answer.tempo as number, previous.tempo)
      : previous.tempo
    const sound =
      typeof answer.sound === 'string' && answer.sound.trim()
        ? answer.sound.trim().replace(/[."]+$/, '')
        : undefined
    return { mode: answer.mode as ModeName, tempo, ...(sound ? { sound } : {}) }
  } catch (error) {
    console.warn(`the mind did not hear the mood: ${error}`)
    return previous
  }
}
