// Sweeping up after waking.
//
// The song keeps its recordings only while someone may still hear them,
// and lets them go once they have been sung. But a song that was stopped
// had recordings ready for iterations it never sang, and when it wakes it
// remembers its words, not its recordings. Those would stay on the disk
// for ever. So when the song wakes, it sweeps away every recording it
// left behind: nothing it is about to sing needs them, and anything it
// sings again, it can sing again.

import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

/** Deletes the recordings in these places that are older than `before`. Returns how many. */
export async function sweep(
  places: readonly string[],
  before: number = Date.now(),
): Promise<number> {
  let swept = 0
  for (const place of places) {
    const names = await readdir(place).catch(() => [] as string[])
    for (const name of names) {
      if (!/\.(m4a|wav)$/.test(name)) continue
      const file = join(place, name)
      const { mtimeMs, isFile } = await stat(file).then(
        (s) => ({ mtimeMs: s.mtimeMs, isFile: s.isFile() }),
        () => ({ mtimeMs: Infinity, isFile: false }),
      )
      if (!isFile || mtimeMs >= before) continue
      await rm(file, { force: true })
      swept++
    }
  }
  return swept
}
