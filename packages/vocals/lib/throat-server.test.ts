import { describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHandler } from '../throat-server.js'

describe('throat-server', () => {
  it('serves Chimera static assets, /healthz, /plugin redirect, and blocks traversal', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ikuradio-throat-srv-'))
    try {
      await mkdir(join(dir, 'assets'), { recursive: true })
      await mkdir(join(dir, 'plugin'), { recursive: true })
      await writeFile(join(dir, 'index.html'), '<!doctype html><title>CHIMERA</title>')
      await writeFile(join(dir, 'plugin', 'index.html'), '<!doctype html><title>Plugin</title>')
      await writeFile(join(dir, 'assets', 'chimera-abc.wasm'), new Uint8Array([0, 97, 115, 109]))
      await writeFile(join(dir, 'throat.json'), JSON.stringify({ revision: '6281c32' }))

      const handle = createHandler(dir)

      const health = handle(new Request('https://throat.ikurad.io/healthz'))
      expect(health.status).toBe(200)
      expect(await health.text()).toBe('ok\n')

      const index = handle(new Request('https://throat.ikurad.io/'))
      expect(index.status).toBe(200)
      expect(index.headers.get('content-type')).toBe('text/html; charset=utf-8')
      expect(index.headers.get('cache-control')).toBe('no-cache')

      const wasm = handle(new Request('https://throat.ikurad.io/assets/chimera-abc.wasm'))
      expect(wasm.status).toBe(200)
      expect(wasm.headers.get('content-type')).toBe('application/wasm')
      expect(wasm.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')

      const redir = handle(new Request('https://throat.ikurad.io/plugin'))
      expect(redir.status).toBe(301)
      expect(redir.headers.get('location')).toBe('https://throat.ikurad.io/plugin/')

      const plugin = handle(new Request('https://throat.ikurad.io/plugin/'))
      expect(plugin.status).toBe(200)
      expect(await plugin.text()).toContain('Plugin')

      const meta = handle(new Request('https://throat.ikurad.io/throat.json'))
      expect(meta.status).toBe(200)
      expect(meta.headers.get('content-type')).toBe('application/json; charset=utf-8')

      const traversal = handle(new Request('https://throat.ikurad.io/%2e%2e/%2e%2e/etc/passwd'))
      expect(traversal.status).toBe(404)

      const post = handle(new Request('https://throat.ikurad.io/', { method: 'POST' }))
      expect(post.status).toBe(405)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
