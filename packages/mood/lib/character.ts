// A Mood is only words. The mind listens to the words and tells the tune
// what it hears: a mode, and a tempo.
//
// The tempo is not allowed to leap. Whatever the mind hears, the song moves
// at most a few beats per minute from where it was, the way a walker changes
// pace, not the way a radio changes station.

import { modes, type Breath, type Character, type ModeName, type Singer } from 'melody'
import { ask, Unshapely } from 'tools'

const slowest = 56
const fastest = 132
/** How far the tempo may move between two Songs, in beats per minute. */
const stride = 16

const schema = {
  type: 'object',
  properties: {
    mode: { type: 'string', enum: Object.keys(modes) },
    tempo: { type: 'integer', minimum: slowest, maximum: fastest },
    // room enough that the mind is never cut off mid-word; the band is trimmed after
    sound: { type: 'string', minLength: 8, maxLength: 240 },
    lead: { type: 'string', enum: ['female', 'male', 'child'] },
    breath: { type: 'string', enum: ['soft', 'plain', 'pressed'] },
  },
  required: ['mode', 'tempo', 'sound', 'lead', 'breath'],
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

Describe the sound of the band that plays under the voice in that mood, in at most twelve words, the way a musician would say it to the band: its instruments and its style, for example "slow string quartet with a cello drone" or "dusty desert blues guitar and hand drums". The mood may be a feeling, a place or a picture; say how it sounds. Do not mention singing, a voice or words.

Choose who leads the singing in that mood: a female, a male or a child voice. And choose how the choir sings: soft (breathy, close, intimate), plain, or pressed (strong, clear, carrying far).`

/** Keeps a tempo within reach of the previous one, and within what a throat can sing. */
export function settle(tempo: number, previous: number): number {
  const reachable = Math.min(
    previous + stride,
    Math.max(previous - stride, tempo),
  )
  return Math.round(Math.min(fastest, Math.max(slowest, reachable)))
}

/** The words of a phrase that carry meaning, small ones left out. */
const meaningful = (text: string) =>
  (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 3)

/**
 * Whether a band is only the Mood's own words handed back. Asked how
 * "chamber music + gregorian chant" sounds, a mind will sometimes just say
 * "chamber music + gregorian chant".
 */
export function echoesMood(sound: string, descriptions: readonly string[]) {
  const ours = meaningful(sound)
  if (ours.length === 0) return true
  const theirs = new Set(descriptions.flatMap(meaningful))
  return ours.filter((w) => theirs.has(w)).length / ours.length >= 0.6
}

/** The voice the mind heard, if it named one the song has. */
function voiceOf(
  lead: string | undefined,
  breath: string | undefined,
): Character['voice'] {
  const leads: Singer[] = ['female', 'male', 'child']
  const breaths: Breath[] = ['soft', 'plain', 'pressed']
  if (!leads.includes(lead as Singer) || !breaths.includes(breath as Breath)) return undefined
  return { lead: lead as Singer, breath: breath as Breath }
}

/** How many words of a band the Music is told. */
const bandWords = 14

/**
 * A band as the Music is told it: plain words only, no more than a musician
 * would say, ending on a whole word, not on "with" or "and" or a letter cut off.
 */
export function band(sound: string): string {
  const words = sound
    .replace(/[^\x20-\x7e]+/g, ' ')
    .replace(/["]+/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, bandWords)
  while (words.length && /^(with|and|or|of|in|an|the|by|to|interspersed|over|under|[a-z])$/i.test(words.at(-1)!.replace(/[,.;:]+$/, ''))) {
    words.pop()
  }
  return words.join(' ').replace(/[,.;:\s]+$/, '')
}

/** How many times the mind is asked to hear a Mood before the song keeps what it had. */
const tries = 3

/**
 * Asks the mind what a Mood sounds like. If the mind does not answer, or
 * answers with something that is not a mode, the song keeps the character it
 * had: the words change, the tune waits. A band that only repeats the Mood's
 * words is asked for again; if the mind cannot hear one, the Music hears the
 * Mood's own words instead.
 */
export async function hear(
  descriptions: readonly string[],
  previous: Character,
): Promise<Character> {
  let heard: Character | undefined
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const answer = await ask<{
        mode?: string
        tempo?: number
        sound?: string
        lead?: string
        breath?: string
      }>({
        instruction,
        input: descriptions.join(' + '),
        schema,
        temperature: 0.7 + attempt * 0.2,
      })
      if (!answer?.mode || !(answer.mode in modes)) continue
      const tempo = Number.isFinite(answer.tempo)
        ? settle(answer.tempo as number, previous.tempo)
        : previous.tempo
      const sound = typeof answer.sound === 'string' ? band(answer.sound) : ''
''
      const voice = voiceOf(answer.lead, answer.breath)
      heard = { mode: answer.mode as ModeName, tempo, ...(voice ? { voice } : {}) }
      if (sound && !echoesMood(sound, descriptions)) return { ...heard, sound }
    } catch (error) {
      // an answer out of shape is asked for again; a mind out of reach is not
      if (error instanceof Unshapely) continue
      console.warn(`the mind did not hear the mood: ${error}`)
      return heard ?? previous
    }
  }
  return heard ?? previous
}
