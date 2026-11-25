import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { composer } from './serve.js'

const partsLib = fileURLToPath(new URL('../../parts/lib/', import.meta.url))
const typebox = Bun.resolveSync('typebox', partsLib)

const get = async (answer: (request: Request) => Promise<Response>, path: string) => answer(new Request(`http://composer.test${path}`))

describe('the real parts and Arrangements', () => {
  const answer = composer()

  it('answers the page and the files it needs', async () => {
    for (const path of ['/', '/map.js', '/composer.css', '/concept.js', '/parts/', '/parts/view.js', '/arrangement/', '/arrangement/view.js']) expect((await get(answer, path)).status).toBe(200)
    expect((await get(answer, '/nothing.js')).status).toBe(404)
    expect((await get(answer, '/..%2Fpackage.json')).status).toBe(404)
  })

  it('answers every part, with its record, what it is, and its parameters with their ranges', async () => {
    const found = (await (await get(answer, '/parts.json')).json()) as { id: string; title: string; text: string; words: string; ending: string; parameters: { name: string; minimum?: number; maximum?: number; default?: number }[] }[]
    expect(found.map(({ id }) => id).sort()).toEqual(['bridge', 'chorus', 'interlude', 'outro', 'pre-chorus', 'refrain', 'silence', 'spoken', 'verse'])
    const verse = found.find(({ id }) => id === 'verse')!
    expect(verse.title).toBeTruthy()
    expect(verse.text.length).toBeGreaterThan(20)
    expect(verse.parameters.find(({ name }) => name === 'wordiness')).toMatchObject({ minimum: 0, maximum: 1, default: 0.5 })
    expect(found.find(({ id }) => id === 'bridge')).toMatchObject({ words: 'none', beats: 16 })
  })

  it('answers every Arrangement with its layout, at a tempo that may be asked for', async () => {
    const arrangements = (await (await get(answer, '/arrangements.json?tempo=90')).json()) as { id: string; layout: { tempo: number; instances: unknown[] } }[]
    expect(arrangements.map(({ id }) => id)).toEqual([
      'tempo-turns',
      'the-ascent',
      'the-clockwork',
      'the-long-breath',
      'the-nocturne',
      'the-song',
      'the-triptych',
    ])
    const song = arrangements.find(({ id }) => id === 'the-song')
    expect(song!.layout.tempo).toBe(90)
    expect(song!.layout.instances).toHaveLength(20)
    // a tempo that is not one is the usual
    expect(((await (await get(answer, '/arrangements.json?tempo=nonsense')).json()) as { layout: { tempo: number } }[])[0]!.layout.tempo).toBe(72)
  })
})

describe('a part nobody has told the Composer of', () => {
  it('is shown, and laid out, without a line of code changed', async () => {
    const home = mkdtempSync(join(tmpdir(), 'parts-'))
    const dir = join(home, 'refrain')
    mkdirSync(dir)
    writeFileSync(join(dir, 'part.md'), '---\nstate: active\nid: 7\nkind: part\nslug: refrain\n---\n# The refrain returns\n\nEight beats of nothing but itself.\n')
    writeFileSync(
      join(dir, 'part.ts'),
      `import { Type } from '${typebox}'\nimport { Part } from '${partsLib}part.ts'\nclass Refrain extends Part {\n  readonly id = 'refrain'\n  readonly words = 'none'\n  readonly ending = 'half'\n  readonly beats = 8\n  readonly parameters = Type.Object({ echoes: Type.Number({ minimum: 1, maximum: 4, default: 2, description: 'How many times it returns' }) })\n  measure() { return { target: 0, most: 0, grows: false } }\n  phrases() { return [] }\n}\nexport default new Refrain()\n`,
    )
    const arrangements = mkdtempSync(join(tmpdir(), 'arrangements-'))
    const one = join(arrangements, 'only-refrain')
    mkdirSync(one)
    writeFileSync(join(one, 'arrangement.md'), '---\nstate: active\nid: 1\nkind: arrangement\nslug: only-refrain\n---\n# Only the refrain\n\nIt comes, and comes.\n')
    writeFileSync(join(one, 'arrangement.json'), JSON.stringify({ id: 'only-refrain', title: 'Only the refrain', instances: [{ name: 'a', part: 'refrain' }, { name: 'b', part: 'refrain', parameters: { echoes: 3 } }] }))

    const answer = composer({ partsHome: home, arrangementsDir: arrangements })
    const parts = (await (await get(answer, '/parts.json')).json()) as { id: string; title: string; beats: number; parameters: { name: string; maximum: number }[] }[]
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ id: 'refrain', title: 'The refrain returns', beats: 8 })
    expect(parts[0]!.parameters[0]).toMatchObject({ name: 'echoes', maximum: 4 })
    const [shown] = (await (await get(answer, '/arrangements.json')).json()) as { layout: { beats: number; instances: { part: string; start: number }[] } }[]
    expect(shown!.layout.beats).toBe(16)
    expect(shown!.layout.instances.map(({ part, start }) => [part, start])).toEqual([['refrain', 0], ['refrain', 8]])
  })
})

describe('no closed union, and no part named', () => {
  it('names no part anywhere in the Composer, in code or in its page', () => {
    const sources: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules') continue
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.(ts|js|html|css)$/.test(name) && !name.endsWith('.test.ts')) sources.push(path)
      }
    }
    walk(fileURLToPath(new URL('../', import.meta.url)))
    expect(sources.length).toBeGreaterThan(5)
    // no part is named: the pages never, and the code never as an id in quotes or in a union (the Tune's own phrases are melody's, not parts)
    const isPage = (path: string) => /\/public\//.test(path) || /\/view\.js$/.test(path)
    for (const path of sources) {
      const text = readFileSync(path, 'utf8')
      expect(text).not.toMatch(/['"`](verse|chorus|bridge)['"`]/)
      if (isPage(path)) expect(text).not.toMatch(/\b(verse|chorus|bridge)\b/i)
      // nor a Track, in the Composer's code or in the page of the Arrangements: the Tracks there are come in the answers, with what they are (the pages of what a Song makes talk of a guide, which is not a Track)
      if (/\/lib\/[^/]+\.ts$/.test(path) || /\/arrangement\/view\.js$/.test(path)) expect(text).not.toMatch(/['"`](voice|bed|guide)['"`]/)
      if (/\/arrangement\/view\.js$/.test(path)) expect(text).not.toMatch(/\b(voice|bed|guide)\b/i)
    }
  })
})

describe('POST /format and /tracks.json', () => {
  const answer = composer()
  it('gives an accepted Arrangement as the text of its file, and a refused one its refusal', async () => {
    const declared = readFileSync(fileURLToPath(new URL('../../parts/arrangements/tempo-turns/arrangement.json', import.meta.url)), 'utf8')
    const said = (await (await answer(new Request('http://composer.test/format', { method: 'POST', body: declared }))).json()) as { text?: string; refusal?: string }
    expect(said.text).toBe(declared)
    const broken = JSON.parse(declared)
    broken.turns = [{ region: 'verse-1', edge: 'start' }]
    expect(((await (await answer(new Request('http://composer.test/format', { method: 'POST', body: JSON.stringify(broken) }))).json()) as { refusal: string }).refusal).toContain('turn 1: it is at the very start')
    expect((await get(answer, '/format')).status).toBe(405)
  })

  it('lists the Tracks, with what makes them and the parameters a Block of each may be given', async () => {
    const tracks = (await (await get(answer, '/tracks.json')).json()) as { id: string; heard: boolean; makes: unknown; parameters: { name: string; minimum?: number; maximum?: number }[] }[]
    expect(tracks.map(({ id }) => id)).toEqual(['bed', 'drone', 'drums', 'guide', 'pulse', 'voice'])
    expect(tracks.find(({ heard }) => !heard)!.parameters).toEqual([])
    expect(tracks.find(({ id }) => id === 'bed')!.parameters.map(({ name }) => name).sort()).toEqual(['fadeIn', 'fadeOut', 'gain'])
    expect(tracks.find(({ id }) => id === 'bed')!.parameters.find(({ name }) => name === 'gain')).toMatchObject({ minimum: 0, maximum: 2 })
  })
})

describe('POST /check', () => {
  const answer = composer()
  const check = async (body: unknown, query = '') => (await answer(new Request(`http://composer.test/check${query}`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }))).json() as Promise<{ refusal?: string; layout?: { tempo: number; beats: number; instances: { name: string }[] } }>

  it('gives the Song the layout /arrangements.json gives', async () => {
    const song = ((await (await get(answer, '/arrangements.json?tempo=80')).json()) as { id: string; layout: unknown; timeline: unknown }[]).find(({ id }) => id === 'the-song')
    const declared = JSON.parse(readFileSync(fileURLToPath(new URL('../../parts/arrangements/the-song/arrangement.json', import.meta.url)), 'utf8'))
    expect((await check(declared, '?tempo=80')) as unknown).toEqual({ layout: song!.layout, timeline: song!.timeline })
  })

  it('says each refusal in its words', async () => {
    const good = () => JSON.parse(readFileSync(fileURLToPath(new URL('../../parts/arrangements/the-song/arrangement.json', import.meta.url)), 'utf8'))
    const refused = async (change: (a: any) => void) => {
      const a = good()
      change(a)
      return (await check(a)).refusal
    }
    expect(await refused((a) => (a.instances[0].part = 'unknown-part'))).toContain('must be one of')
    expect(await refused((a) => (a.instances[0].parameters = { wordiness: 3 }))).toContain('/wordiness')
    expect(await refused((a) => (a.instances[1].parameters = { wordiness: 0.5 }))).toContain('must not have additional properties: wordiness')
    expect(await refused((a) => (a.instances[1].name = 'verse-1'))).toContain('one name, one part')
    expect(await refused((a) => (a.instances = []))).toContain('/instances')
    expect((await check('{ not json')).refusal).toContain('not JSON')
  })

  it('takes only a POST', async () => {
    expect((await get(answer, '/check')).status).toBe(405)
  })

  it('accepts an Arrangement of a part nobody told it of, from a temporary folder', async () => {
    const home = mkdtempSync(join(tmpdir(), 'parts-'))
    const dir = join(home, 'refrain')
    mkdirSync(dir)
    writeFileSync(join(dir, 'part.md'), '---\nstate: active\nid: 7\nkind: part\nslug: refrain\n---\n# The refrain returns\n\nEight beats.\n')
    writeFileSync(
      join(dir, 'part.ts'),
      `import { Type } from '${typebox}'\nimport { Part } from '${partsLib}part.ts'\nclass Refrain extends Part {\n  readonly id = 'refrain'\n  readonly words = 'none'\n  readonly ending = 'half'\n  readonly beats = 8\n  readonly parameters = Type.Object({ echoes: Type.Number({ minimum: 1, maximum: 4, default: 2 }) })\n  measure() { return { target: 0, most: 0, grows: false } }\n  phrases() { return [] }\n}\nexport default new Refrain()\n`,
    )
    const made = composer({ partsHome: home })
    const asked = await made(new Request('http://composer.test/check', { method: 'POST', body: JSON.stringify({ id: 'r', title: 'R', instances: [{ name: 'a', part: 'refrain', parameters: { echoes: 3 } }, { name: 'b', part: 'refrain' }] }) }))
    const { layout } = (await asked.json()) as { layout: { beats: number } }
    expect(layout.beats).toBe(16)
    const refused = await made(new Request('http://composer.test/check', { method: 'POST', body: JSON.stringify({ id: 'r', title: 'R', instances: [{ name: 'a', part: 'refrain', parameters: { echoes: 9 } }] }) }))
    expect(((await refused.json()) as { refusal: string }).refusal).toContain('/echoes')
  })
})
