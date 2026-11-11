import { describe, expect, it } from 'bun:test'
import { mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sweep } from './sweep.js'

describe('sweep', () => {
  it('lets go of recordings left behind, and of nothing else', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'song-sweep-'))
    try {
      const old = Date.now() / 1000 - 3600
      for (const name of ['left.m4a', 'bed.m4a', 'notes.txt']) {
        await writeFile(join(dir, name), '')
        await utimes(join(dir, name), old, old)
      }
      await writeFile(join(dir, 'new.m4a'), '')
      const swept = await sweep([dir, join(dir, 'missing')], Date.now() - 60_000)
      expect(swept).toBe(2)
      expect((await readdir(dir)).sort()).toEqual(['new.m4a', 'notes.txt'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
