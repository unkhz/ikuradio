import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { conceptsHome, readConcepts } from './concepts.js'
import { composer } from './serve.js'

const get = (answer: (request: Request) => Promise<Response>, path: string) => answer(new Request(`http://composer.test${path}`))

const record = (slug: string, { band = 'made', leads = '', id = 20, edits }: { band?: string; leads?: string; id?: number; edits?: string } = {}) =>
  `---\nstate: active\nid: ${id}\nkind: concept\nslug: ${slug}\n${edits ? `edits: ${edits}\n` : ''}band: ${band}\nleads: ${leads}\n---\n# ${slug}\n\nA short line about ${slug}.\n\nAnd more.\n`

/** A folder of concepts with one whole concept in it, made as a person would make one. */
function folderWith(slug: string, options: Parameters<typeof record>[1] = {}) {
  const home = mkdtempSync(join(tmpdir(), 'concepts-'))
  return { home, dir: addTo(home, slug, options) }
}

/** Another whole concept in a folder of them; its folder. */
function addTo(home: string, slug: string, options: Parameters<typeof record>[1] = {}) {
  const dir = join(home, slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'concept.md'), record(slug, options))
  writeFileSync(join(dir, 'data.ts'), 'export default () => ({ hello: 1 })\n')
  writeFileSync(join(dir, 'view.js'), 'function drawConcept(root) { root.append(el("p", { textContent: "hello" })) }\n')
  return dir
}

describe('the concepts there are', () => {
  it('has every folder on the map, ten of them, in three bands', async () => {
    const folders = readdirSync(conceptsHome, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    const found = await readConcepts()
    expect(found.map(({ id }) => id).sort()).toEqual(folders.sort())
    expect(found).toHaveLength(10)
    const inBand = (band: string) => found.filter((concept) => concept.band === band).map(({ id }) => id).sort()
    expect(inBand('shapes')).toEqual(['mood', 'perspectives', 'tides'])
    expect(inBand('edits')).toEqual(['arrangement', 'parts'])
    expect(inBand('made')).toEqual(['beds', 'lyrics', 'score', 'song', 'tune'])
  })

  it('leads where the scientist drew it, and every lead names a concept that is there', async () => {
    const found = await readConcepts()
    const leads = Object.fromEntries(found.map(({ id, leads }) => [id, [...leads].sort()]))
    expect(leads).toEqual({
      mood: ['tune'],
      perspectives: ['parts'],
      tides: ['parts'],
      arrangement: ['parts'],
      parts: ['lyrics', 'tune'],
      tune: ['score'],
      lyrics: ['score', 'song'],
      score: ['beds'],
      beds: ['song'],
      song: [],
    })
    const ids = new Set(found.map(({ id }) => id))
    for (const concept of found) for (const lead of concept.leads) expect(ids.has(lead)).toBe(true)
  })

  it('says a short line and the rest from the record', async () => {
    const [mood] = await readConcepts()
    expect(mood!.title).toBe('Mood')
    expect(mood!.line.length).toBeGreaterThan(20)
    expect(mood!.more.length).toBeGreaterThan(0)
  })
})

describe('a folder that is not whole', () => {
  it('a lead into what is not a concept is refused, naming the folder', async () => {
    const { home, dir } = folderWith('stray', { leads: 'nowhere' })
    await expect(readConcepts(home)).rejects.toThrow(new RegExp(`${dir}.*"nowhere", which is not a concept`))
  })

  it('a band that is none, a missing script, a reserved id, a folder that is not its id: each said', async () => {
    await expect(readConcepts(folderWith('odd', { band: 'sideways' }).home)).rejects.toThrow(/its band is "sideways"/)
    const missing = folderWith('lacking')
    mkdirSync(join(missing.home, 'bare'))
    writeFileSync(join(missing.home, 'bare', 'concept.md'), record('bare'))
    await expect(readConcepts(missing.home)).rejects.toThrow(/bare.*its data\.ts, and this one does not/)
    await expect(readConcepts(folderWith('check').home)).rejects.toThrow(/"check" cannot be a concept's id/)
    const wrong = folderWith('right')
    writeFileSync(join(wrong.dir, 'concept.md'), record('wrong'))
    await expect(readConcepts(wrong.home)).rejects.toThrow(/a concept's id is its folder's/)
  })

  it('is said by the server, loudly, and not hidden', async () => {
    const { home } = folderWith('stray', { leads: 'nowhere' })
    const answer = composer({ conceptsDir: home })
    const response = await get(answer, '/concepts.json')
    expect(response.status).toBe(500)
    expect(await response.text()).toContain('which is not a concept')
  })
})

describe('the map, and the pages', () => {
  it('answers every concept as a record with its leads, and every box has a page, a script and data', async () => {
    const answer = composer()
    const found = (await (await get(answer, '/concepts.json')).json()) as { id: string; band: string; leads: string[]; line: string }[]
    expect(found).toHaveLength(10)
    for (const { id } of found) {
      expect((await get(answer, `/${id}/`)).status).toBe(200)
      expect((await get(answer, `/${id}/view.js`)).status).toBe(200)
      expect((await get(answer, `/${id}.json`)).status).toBe(200)
    }
  })

  it('gives the parts and the Arrangements as the pages of those concepts, as they were said before', async () => {
    const answer = composer()
    const parts = (await (await get(answer, '/parts.json')).json()) as { id: string }[]
    expect(parts.map(({ id }) => id).sort()).toEqual(['bridge', 'chorus', 'interlude', 'pre-chorus', 'refrain', 'silence', 'spoken', 'verse'])
    const asked = (await (await get(answer, '/arrangement.json?tempo=90')).json()) as { layout: { tempo: number } }[]
    expect(asked[0]!.layout.tempo).toBe(90)
    expect(await (await get(answer, '/arrangements.json?tempo=90')).json()).toEqual(asked)
  })

  it('has a page for every concept: none is left saying it is not drawn yet', async () => {
    const answer = composer()
    const found = (await (await get(answer, '/concepts.json')).json()) as { id: string }[]
    for (const { id } of found) {
      const data = await (await get(answer, `/${id}.json`)).json()
      expect(Object.keys(data as object)).not.toContain('comes')
      expect(await (await get(answer, `/${id}/view.js`)).text()).not.toContain('is not drawn yet')
    }
  })

  it('shows a concept nobody told the Composer of, linked, with no code changed', async () => {
    const { home } = folderWith('ending', { band: 'made', id: 10 })
    addTo(home, 'echoes', { band: 'made', leads: 'ending', id: 11 })
    const answer = composer({ conceptsDir: home })
    const found = (await (await get(answer, '/concepts.json')).json()) as { id: string; band: string; leads: string[]; title: string; line: string }[]
    expect(found).toHaveLength(2)
    expect(found.at(-1)).toMatchObject({ id: 'echoes', band: 'made', leads: ['ending'], title: 'echoes', line: 'A short line about echoes.' })
    expect((await get(answer, '/echoes/')).status).toBe(200)
    expect(await (await get(answer, '/echoes.json')).json()).toEqual({ hello: 1 })
    expect(await (await get(answer, '/echoes/view.js')).text()).toContain('drawConcept')
  })

  it('answers where every box stands and every arrow runs, and a concept nobody told it of stands there too', async () => {
    const { home } = folderWith('ending', { band: 'made', id: 10 })
    addTo(home, 'echoes', { band: 'made', leads: 'ending', id: 11 })
    const layout = (await (await get(composer({ conceptsDir: home }), '/map.json')).json()) as { boxes: { id: string; row: number }[]; arrows: { from: string; to: string }[] }
    expect(layout.boxes.map(({ id }) => id)).toEqual(['ending', 'echoes'])
    expect(layout.arrows.map(({ from, to }) => `${from}>${to}`)).toEqual(['echoes>ending'])
    const real = (await (await get(composer(), '/map.json')).json()) as { boxes: unknown[]; arrows: unknown[] }
    expect(real.boxes).toHaveLength(10)
    expect(real.arrows).toHaveLength(11)
  })

  it('names no concept in the map or the page that draws it', async () => {
    const answer = composer()
    for (const path of ['/map.js', '/concept.js', '/mode.js', '/shell.js', '/', '/concept.html']) {
      const text = await (await get(answer, path)).text()
      expect(text).not.toMatch(/\b(mood|perspectives|tides|arrangement|lyrics|beds)\b/i)
    }
  })
})

describe('Learn and Edit', () => {
  it('says of every concept what its page in Edit is: files, parameters, a bench or nothing', async () => {
    const found = await readConcepts()
    expect(Object.fromEntries(found.map(({ id, edits }) => [id, edits]))).toEqual({
      mood: 'bench',
      tune: 'bench',
      lyrics: 'bench',
      score: 'bench',
      beds: 'bench',
      song: 'bench',
      arrangement: 'files',
      perspectives: 'files',
      tides: 'files',
      parts: 'parameters',
    })
    const answered = (await (await get(composer(), '/concepts.json')).json()) as { id: string; edits: string }[]
    expect(answered.find(({ id }) => id === 'arrangement')!.edits).toBe('files')
  })

  it('says a concept that says nothing edits nothing, and refuses one that says what is not a workspace', async () => {
    const { home } = folderWith('quiet', { id: 10 })
    expect((await readConcepts(home))[0]!.edits).toBe('nothing')
    const { home: other } = folderWith('odd', { id: 10, edits: 'everything' })
    await expect(readConcepts(other)).rejects.toThrow(/what it edits is "everything"/)
  })

  it("serves the scripts of a concept's own folder, its view, its edit and what they share, and no others", async () => {
    const answer = composer()
    for (const path of ['/arrangement/view.js', '/arrangement/edit.js', '/arrangement/shared.js', '/arrangement/anchors.js', '/mode.js', '/shell.js']) expect((await get(answer, path)).status).toBe(200)
    // what a concept shares is said in its record's answer, for the page to load before its view or its edit
    const found = (await (await get(answer, '/concepts.json')).json()) as { id: string; scripts: string[] }[]
    expect(found.find(({ id }) => id === 'arrangement')!.scripts).toEqual(['anchors.js', 'shared.js'])
    expect(found.find(({ id }) => id === 'mood')!.scripts).toEqual(['shared.js'])
    // a concept whose workspace is not built has no edit.js to serve
    expect((await get(answer, '/echoes/edit.js')).status).toBe(404)
    expect((await get(answer, '/arrangement/concept.md')).status).toBe(404)
    expect((await get(answer, '/arrangement/..%2Fdata.js')).status).toBe(404)
  })

  it('has no editor in any Learn page: no check, no format, no file to open, no draft kept', async () => {
    const found = await readConcepts()
    for (const { dir } of found) {
      const view = readFileSync(join(dir, 'view.js'), 'utf8')
      expect(view).not.toMatch(/\/check|\/format|editShell|type="file"|type: 'file'|localStorage|\.changed\(/)
    }
  })
})
