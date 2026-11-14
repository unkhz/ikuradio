import { createHash } from 'node:crypto'
import { sing } from './exec.js'
import { makeOnce, vocalsDir } from './chimera.js'

export type Placed = {
  file: string
  /** When the recording begins, in seconds from the start of the take. */
  at: number
  /** How loud it is, 1 being as recorded. */
  gain?: number
  /**
   * How long its place lasts. Whatever it holds beyond that is a tail, to
   * be faded out over `fade` seconds while what follows has already begun.
   */
  seconds?: number
  fade?: number
}

/**
 * Lays recordings onto one take, each at its own moment and loudness, so
 * that an iteration can be heard whole, and later handed to the Music as the
 * voice it must accompany.
 */
export async function mixdown(lines: Placed[], out: string) {
  if (lines.length === 0) throw new Error('nothing to mix: no line was sung')
  const inputs = lines.flatMap(({ file }) => ['-i', file])
  const placed = lines.map(({ at, gain = 1, seconds, fade }, i) => {
    // a tail fades out under what follows, and is cut where the fade ends
    const tail =
      seconds !== undefined && fade
        ? `,afade=t=out:st=${seconds.toFixed(3)}:d=${fade.toFixed(3)},atrim=0:${(seconds + fade).toFixed(3)}`
        : ''
    return `[${i}:a]volume=${gain}${tail},adelay=${Math.round(at * 1000)}:all=1[l${i}]`
  })
  const mix = `${lines.map((_, i) => `[l${i}]`).join('')}amix=inputs=${lines.length}:normalize=0[out]`
  await sing('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    ...inputs,
    '-filter_complex',
    [...placed, mix].join(';'),
    '-map',
    '[out]',
    '-c:a',
    'aac',
    '-b:a',
    '64k',
    out,
  ])
}

/** How much louder a whole choir may be than its lead alone. */
export const fullness = 1.5

/**
 * Sings several voices as one: the same line, from several throats, mixed
 * into one recording. A lone voice is returned as it is.
 */
export async function blend(
  voices: { file: string; gain: number }[],
): Promise<string> {
  if (voices.length === 1 && voices[0].gain === 1) return voices[0].file
  const name = createHash('sha256')
    .update(JSON.stringify({ fullness, voices }))
    .digest('hex')
  // many voices are fuller than one, but not louder than a throat can bear
  const total = voices.reduce((sum, { gain }) => sum + gain, 0)
  const headroom = Math.min(1, fullness / total)
  return makeOnce(`${vocalsDir}/${name}.m4a`, (partial) =>
    mixdown(
      voices.map(({ file, gain }) => ({ file, gain: gain * headroom, at: 0 })),
      partial,
    ),
  )
}
