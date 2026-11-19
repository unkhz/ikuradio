// The Receiver's build (plan "The Receiver updates itself"). The page is the
// files of public/, and a browser that holds them should not be asked for a
// file that did not change. So each file is named by a hash of what it holds:
// `index.js` becomes `index.<hash>.js`; the index, which learns the names, is
// the one file that keeps its own. Every place that names a file by hand is
// rewritten to name the hashed one, and the hash is taken after that, so a
// file whose own references changed is a new file too. The release the Radio
// is built from is stamped into the index, so a page knows what it is.
//
// Writes to dist/: the hashed files, `manifest.json`, and `receiver.ts`, which
// the Radio imports, each file `with { type: 'file' }`, so the executable that
// is compiled carries them. Run it as `bun run receiver`, with `RELEASE` set
// to the git hash the Radio is built from.

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.gz': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

/** One file of the page: where it is, what it holds, and whether its name is a hash of that. */
export type Part = {
  /** Its place in the page, as it is named by hand: `throat/chimera.wasm`. */
  name: string
  body: Uint8Array
  /** The name it is served by, hashed unless it keeps its own. */
  served: string
  type: string
}

const text = new Set(['.html', '.js', '.svg', '.webmanifest'])
/** What keeps its name: the index, which tells the others', and licenses, which no one links to. */
const keeps = (name: string) => name === 'index.html' || /LICENSE/i.test(name)

const hashOf = (body: Uint8Array) => createHash('sha256').update(body).digest('hex').slice(0, 10)

/** `fonts/doto.woff2` named by its hash: `fonts/doto.<hash>.woff2`. */
export const hashed = (name: string, hash: string) => {
  const ext = name.endsWith('.txt.gz') ? '.txt.gz' : extname(name)
  return `${name.slice(0, name.length - ext.length)}.${hash}${ext}`
}

/** Whitespace out, nothing renamed: the page's scripts keep every name they have. */
const minify = (source: string) => new Bun.Transpiler({ loader: 'js', minifyWhitespace: true }).transformSync(source)

/**
 * The page's files, hashed. `files` are by name, as public/ holds them.
 * Returns each by the name it is served by, in the order they were made,
 * every file after the files it names.
 */
export function hash(files: ReadonlyMap<string, Uint8Array>, release: string): Part[] {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const names = [...files.keys()]
  const source = (name: string) => (text.has(extname(name)) ? decoder.decode(files.get(name)!) : undefined)
  // who names whom, by the path the page gives: `/space.js`, as an import `./throat.js` ends in too
  const names_of = new Map(
    names.map((name) => {
      const content = source(name)
      return [name, content === undefined ? [] : names.filter((other) => other !== name && !keeps(other) && content.includes(`/${other}`))]
    }),
  )
  const made = new Map<string, Part>()
  const making = new Set<string>()
  const order: Part[] = []
  const make = (name: string) => {
    if (made.has(name)) return made.get(name)!
    if (making.has(name)) throw new Error(`${name} names itself through ${[...making].join(' → ')}`)
    making.add(name)
    let body = files.get(name)!
    const content = source(name)
    if (content !== undefined) {
      let written = content
      for (const other of names_of.get(name)!) {
        const part = make(other)
        written = written.split(`/${other}`).join(`/${part.served}`)
      }
      if (name === 'index.html') {
        written = written.replace('<meta charset="utf-8" />', () => `<meta charset="utf-8" />\n    <meta name="release" content="${release}" />`)
      }
      if (name.endsWith('.js') && name !== 'verses.js') written = minify(written)
      body = encoder.encode(written)
    }
    const part: Part = {
      name,
      body,
      served: keeps(name) ? name : hashed(name, hashOf(body)),
      type: types[name.endsWith('.txt.gz') ? '.gz' : extname(name)] ?? 'application/octet-stream',
    }
    making.delete(name)
    made.set(name, part)
    order.push(part)
    return part
  }
  for (const name of names) make(name)
  return order
}

/** The Radio's module: every file imported as a file, and what it is named. */
export function moduleOf(parts: readonly Part[], release: string): string {
  const imports = parts.map((part, i) => `import f${i} from './${part.served}' with { type: 'file' }`)
  const files = parts.map(
    (part, i) => `  ${JSON.stringify(part.served)}: { file: f${i} as unknown as string, type: ${JSON.stringify(part.type)}, immutable: ${part.served !== part.name} },`,
  )
  const named = parts.map((part) => `  ${JSON.stringify(part.name)}: ${JSON.stringify(part.served)},`)
  return [
    '// @ts-nocheck',
    '// Written by packages/ui/build.ts. Do not edit: it is built again with every Radio.',
    ...imports,
    '',
    `export const release = ${JSON.stringify(release)}`,
    '/** Every file of the page, by the name it is served by. */',
    `export const files: Record<string, { file: string; type: string; immutable: boolean }> = {`,
    ...files,
    '}',
    '/** The name each file is served by, by the name it is given by hand. */',
    `export const named: Record<string, string> = {`,
    ...named,
    '}',
    '',
  ].join('\n')
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else yield path
  }
}

if (import.meta.main) {
  const release = process.env.RELEASE?.trim() || 'dev'
  const publicDir = join(here, 'public')
  const dist = join(here, 'dist')
  const files = new Map<string, Uint8Array>()
  for await (const path of walk(publicDir)) files.set(relative(publicDir, path), new Uint8Array(await readFile(path)))
  const parts = hash(files, release)
  await rm(dist, { recursive: true, force: true })
  for (const part of parts) {
    await mkdir(dirname(join(dist, part.served)), { recursive: true })
    await writeFile(join(dist, part.served), part.body)
  }
  await writeFile(join(dist, 'receiver.ts'), moduleOf(parts, release))
  console.log(`The Receiver is built for release ${release}: ${parts.length} files, ${parts.filter((p) => p.served !== p.name).length} named by their hashes`)
}
