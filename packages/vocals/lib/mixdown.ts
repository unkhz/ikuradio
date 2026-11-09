import { run } from './exec.js'

export type Placed = {
  file: string
  /** When the line begins, in seconds from the start of the take. */
  at: number
}

/**
 * Lays recorded lines onto one take, each at its own moment, so that an
 * iteration can be heard whole, and later handed to the Music as the voice
 * it must accompany.
 */
export async function mixdown(lines: Placed[], out: string) {
  if (lines.length === 0) throw new Error('nothing to mix: no line was sung')
  const inputs = lines.flatMap(({ file }) => ['-i', file])
  const delays = lines.map(
    ({ at }, i) => `[${i}:a]adelay=${Math.round(at * 1000)}:all=1[l${i}]`,
  )
  const mix = `${lines.map((_, i) => `[l${i}]`).join('')}amix=inputs=${lines.length}:normalize=0[out]`
  await run('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    ...inputs,
    '-filter_complex',
    [...delays, mix].join(';'),
    '-map',
    '[out]',
    out,
  ])
}
