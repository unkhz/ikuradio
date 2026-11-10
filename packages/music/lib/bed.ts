// The bed: music grown under a part of the song, by a model that hears the
// voice only as the shape of its pitches, and the Mood only as words.
//
// The model is woken for each bed and let go after it. The machine has one
// GPU, and the mind that writes the words needs most of it, so the two take
// turns: the words of an iteration are written first, and its beds after.

import { createHash } from 'node:crypto'
import { mkdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Mood } from 'mood'
import { run, Turns } from 'vocals'

/** Where beds are kept, relative to the process, beside the voices. */
export const musicDir = 'audio/music'

/**
 * The longest bed grown, in seconds. The model hears only half a minute at a
 * time, so a longer bed is grown in overlapping windows; no section of the
 * song is ever this long.
 */
export const longest = 90

/** The model that makes the beds. Changing it changes every bed, so it is part of each bed's name. */
const model = 'facebook/musicgen-melody'

const home = fileURLToPath(new URL('../', import.meta.url))

/** Modes that sound bright, to a listener who knows only major and minor. */
const bright = new Set(['ionian', 'lydian', 'mixolydian'])

/**
 * The Mood in words a music model understands: the weather, the pulse, and
 * whether it is bright or dark. The mode itself is too fine a word for it;
 * the voice carries the mode, and the bed follows the voice.
 */
export function words({ descriptions, character }: Mood): string {
  const key = bright.has(character.mode) ? 'major key' : 'minor key'
  return [...descriptions, `${character.tempo} bpm`, key].join(', ')
}

async function exists(file: string) {
  try {
    return (await stat(file)).isFile()
  } catch {
    return false
  }
}

/** One GPU: one bed at a time. */
const gpu = new Turns(1)

/**
 * Grows a bed under a recorded voice. The same voice in the same words is
 * the same bed, so a part that returns is accompanied as it was before, and
 * the song remembers its own music.
 */
export async function accompany({
  vocals,
  mood,
  seconds,
}: {
  vocals: string
  mood: string
  seconds: number
}): Promise<string> {
  seconds = Math.min(longest, Math.round(seconds * 10) / 10)
  const name = createHash('sha256')
    .update(JSON.stringify({ model, vocals, mood, seconds }))
    .digest('hex')
  const file = `${musicDir}/${name}.m4a`
  if (await exists(file)) return file
  await mkdir(musicDir, { recursive: true })
  await gpu.take(() =>
    run(
      'uv',
      [
        'run',
        '--project',
        home,
        `${home}accompany.py`,
        '--vocals',
        vocals,
        '--mood',
        mood,
        '--seconds',
        `${seconds}`,
        '--out',
        file,
      ],
      { gentle: true },
    ),
  )
  return file
}
