import { run } from './exec.js'

/**
 * Plays a recording, a file or a URL, through whatever speaker the machine
 * has, on any system ffmpeg runs on: from `from` seconds into it, at `gain`
 * of its loudness, and, if `pan` is given, placed between the left (-1) and
 * the right (1), at equal power.
 */
export async function play(
  file: string,
  { from = 0, gain = 1, pan }: { from?: number; gain?: number; pan?: number } = {},
) {
  const filters = [
    ...(gain !== 1 ? [`volume=${gain}`] : []),
    ...(pan !== undefined ? [panning(pan)] : []),
  ]
  await run('ffplay', [
    '-nodisp',
    '-autoexit',
    '-loglevel',
    'quiet',
    ...(from > 0 ? ['-ss', from.toFixed(3)] : []),
    ...(filters.length ? ['-af', filters.join(',')] : []),
    file,
  ])
}

/** A mono voice placed between the speakers, at equal power. */
export function panning(pan: number) {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4
  return `pan=stereo|c0=${Math.cos(angle).toFixed(3)}*c0|c1=${Math.sin(angle).toFixed(3)}*c0`
}
