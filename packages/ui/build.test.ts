import { describe, expect, it } from 'bun:test'
import { hash, hashed, moduleOf } from './build.js'

const bytes = (text: string) => new TextEncoder().encode(text)
const files = (entries: Record<string, string>) => new Map(Object.entries(entries).map(([name, text]) => [name, bytes(text)]))

describe('the Receiver, hashed', () => {
  const page = {
    'index.html': '<!doctype html><html><head><meta charset="utf-8" /><script src="/index.js"></script></head></html>',
    'index.js': "new Worker('/worker.js'); fetch('/throat/engine.wasm')",
    'worker.js': "import { open } from './throat.js'",
    'throat.js': 'export const open = 1',
    'throat/engine.wasm': 'wasm',
    'throat/LICENSE.txt': 'free',
  }

  it('names each file by its content, the index and licenses by themselves', () => {
    const parts = hash(files(page), 'abc123')
    const served = Object.fromEntries(parts.map((p) => [p.name, p.served]))
    expect(served['index.html']).toBe('index.html')
    expect(served['throat/LICENSE.txt']).toBe('throat/LICENSE.txt')
    expect(served['index.js']).toMatch(/^index\.[0-9a-f]{10}\.js$/)
    expect(served['throat/engine.wasm']).toMatch(/^throat\/engine\.[0-9a-f]{10}\.wasm$/)
  })

  it('writes the hashed names where files are named by hand, each file after the files it names', () => {
    const parts = hash(files(page), 'abc123')
    const body = (name: string) => new TextDecoder().decode(parts.find((p) => p.name === name)!.body)
    const served = (name: string) => parts.find((p) => p.name === name)!.served
    expect(body('index.html')).toContain(`src="/${served('index.js')}"`)
    expect(body('index.js')).toContain(served('worker.js'))
    expect(body('index.js')).toContain(served('throat/engine.wasm'))
    expect(body('worker.js')).toContain(served('throat.js'))
    expect(parts.map((p) => p.name).indexOf('throat.js')).toBeLessThan(parts.map((p) => p.name).indexOf('worker.js'))
    expect(parts.map((p) => p.name).indexOf('worker.js')).toBeLessThan(parts.map((p) => p.name).indexOf('index.js'))
  })

  it('stamps the release into the index', () => {
    const index = new TextDecoder().decode(hash(files(page), 'abc123').find((p) => p.name === 'index.html')!.body)
    expect(index).toContain('<meta name="release" content="abc123" />')
  })

  it('changes the name of what names a changed file, and no other', () => {
    const before = hash(files(page), 'r')
    const after = hash(files({ ...page, 'throat.js': 'export const open = 2' }), 'r')
    const served = (parts: typeof before, name: string) => parts.find((p) => p.name === name)!.served
    for (const changed of ['throat.js', 'worker.js', 'index.js']) expect(served(after, changed)).not.toBe(served(before, changed))
    expect(served(after, 'throat/engine.wasm')).toBe(served(before, 'throat/engine.wasm'))
  })

  it('refuses files that name each other round', () => {
    expect(() => hash(files({ 'a.js': 'import "/b.js"', 'b.js': 'import "/a.js"' }), 'r')).toThrow()
  })

  it('names a gzipped text by its whole ending, and writes a module that imports every file', () => {
    expect(hashed('throat/cmudict.txt.gz', 'abc')).toBe('throat/cmudict.abc.txt.gz')
    const parts = hash(files(page), 'r')
    const module = moduleOf(parts, 'r')
    expect(module).toContain('export const release = "r"')
    expect(module.match(/with \{ type: 'file' \}/g)).toHaveLength(parts.length)
  })
})
