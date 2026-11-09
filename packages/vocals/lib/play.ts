import { run } from './exec.js'

/** Plays a recording through whatever speaker the machine has, on any system ffmpeg runs on. */
export async function play(file: string) {
  await run('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', file])
}
