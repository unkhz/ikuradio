import { describe, expect, it } from 'bun:test'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeOnce } from './chimera.js'

describe('makeOnce', () => {
  it('makes a recording asked for many times at once only once, and never hands it out half made', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'make-once-'))
    const file = join(dir, 'take.m4a')
    let made = 0
    const make = async (partial: string) => {
      made++
      expect(partial).toEndWith('.partial.m4a')
      await writeFile(partial, 'half')
      await new Promise((r) => setTimeout(r, 30))
      await writeFile(partial, 'whole')
    }
    const got = await Promise.all(Array.from({ length: 5 }, () => makeOnce(file, make)))
    expect(made).toBe(1)
    expect(new Set(got)).toEqual(new Set([file]))
    expect(await readFile(file, 'utf8')).toBe('whole')
    expect(await readdir(dir)).toEqual(['take.m4a'])
    // made already, it is not made again
    expect(await makeOnce(file, make)).toBe(file)
    expect(made).toBe(1)
    await rm(dir, { recursive: true })
  })

  it('leaves nothing behind when making fails, and tries again when asked again', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'make-once-'))
    const file = join(dir, 'take.m4a')
    const failing = async (partial: string) => {
      await writeFile(partial, 'half')
      throw new Error('the throat failed')
    }
    await expect(makeOnce(file, failing)).rejects.toThrow('the throat failed')
    expect(await readdir(dir)).toEqual([])
    expect(await makeOnce(file, (partial) => writeFile(partial, 'whole'))).toBe(file)
    await rm(dir, { recursive: true })
  })
})
