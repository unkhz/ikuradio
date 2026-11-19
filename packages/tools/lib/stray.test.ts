// A bare `tsc` writes a .js and a .js.map beside every .ts. Bun, asked for
// './x.js', loads that literal file and never the x.ts beside it, so a
// compiled copy left in the tree silently shadows its source: the next
// change to the source is not run, and the tests read the stale copy. The
// tree holds none, and this fails where one is found, naming it.
import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))

/** Every file under `dir`, but never what is installed or built. */
function* files(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target' || entry.name === '.chimera') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* files(path)
    else yield path
  }
}

describe('the tree', () => {
  it('holds no compiled copy beside a source it would shadow', () => {
    const all = new Set([...files(join(root, 'packages'))])
    const strays = [...all].filter((file) => {
      if (file.endsWith('.js.map')) return all.has(file.replace(/\.js\.map$/, '.ts'))
      if (!file.endsWith('.js')) return false
      return all.has(file.replace(/\.js$/, '.ts')) || all.has(file.replace(/\.js$/, '.tsx'))
    })
    expect(strays.map((file) => relative(root, file))).toEqual([])
  })
})
