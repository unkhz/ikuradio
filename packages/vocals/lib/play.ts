import { run } from './exec.js'

/**
 * Plays a recording, a file or a URL, through whatever speaker the machine has, on any system
 * ffmpeg runs on: from `from` seconds into it, at `gain` of its loudness.
 */
export async function play(file: string, { from = 0, gain = 1 } = {}) {
  await run('ffplay', [
    '-nodisp',
    '-autoexit',
    '-loglevel',
    'quiet',
    ...(from > 0 ? ['-ss', from.toFixed(3)] : []),
    ...(gain !== 1 ? ['-af', `volume=${gain}`] : []),
    file,
  ])
}
