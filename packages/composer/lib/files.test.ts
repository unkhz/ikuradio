import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { firstTune } from 'melody'
import { readParts } from 'parts'
import { perspectivesHome, readPerspectives } from 'perspectives'
import { readTides, valueAt } from 'tides'
import { composer } from './serve.js'

const answer = composer()
const post = async (path: string, body: unknown) => (await (await answer(new Request(`http://composer.test${path}`, { method: 'POST', body: JSON.stringify(body) }))).json()) as any
const get = async (path: string) => (await (await answer(new Request(`http://composer.test${path}`))).json()) as any

describe("every Perspective's record, at the Composer", () => {
  it('is accepted, and is formatted as the file it is', async () => {
    const { drafts, kinds } = await get('/perspectives.json')
    expect(drafts).toHaveLength(readPerspectives().length)
    expect(kinds.facets).toContain('choir')
    expect(kinds.partFacets.sort()).toEqual(['lyrics', 'melody', 'progression'])
    for (const draft of drafts) {
      const checked = await post('/perspective/check', draft)
      expect(checked.refusal).toBeUndefined()
      const said = await post('/perspective/format', draft)
      expect(said.text).toBe(readFileSync(join(perspectivesHome, draft.slug, 'perspective.md'), 'utf8'))
      expect(said.files).toEqual([{ name: `${draft.slug}.perspective.md`, text: said.text }])
    }
  })

  it('says how often it is drawn, what it clashes with, and what its Turn makes of the Settings', async () => {
    const { drafts } = await get('/perspectives.json')
    const full = drafts.find((draft: any) => draft.slug === 'choir-full')
    const checked = await post('/perspective/check', full)
    expect(checked.odds.active).toBe(true)
    expect(checked.odds.share).toBeCloseTo(full.weight / checked.odds.total, 9)
    expect(checked.clashes.map((one: any) => one.slug).sort()).toEqual(['choir-in-the-verses', 'choir-lone'])
    expect(checked.turn).toBe(true)
    expect(checked.changed.find((leaf: any) => leaf.path.join('.') === 'choir.size')).toMatchObject({ without: 1, with: 4 })
    // heavier, it is drawn more; retired, never
    const heavier = await post('/perspective/check', { ...full, weight: 10 })
    expect(heavier.odds.share).toBeGreaterThan(checked.odds.share)
    expect((await post('/perspective/check', { ...full, state: 'retired' })).odds.share).toBe(0)
    // on another part, a Facet kept for each part clashes with fewer
    const walking = drafts.find((draft: any) => draft.slug === 'progression-walking-verses')
    const other = await post('/perspective/check', { ...walking, part: 'bridge' })
    expect(other.clashes.map((one: any) => one.slug)).not.toContain('progression-verse-homecoming')
    expect((await post('/perspective/check', walking)).clashes.map((one: any) => one.slug)).toContain('progression-verse-homecoming')
  })

  it('says the field a refusal is about', async () => {
    const { drafts } = await get('/perspectives.json')
    const lone = drafts.find((draft: any) => draft.slug === 'choir-lone')
    expect(await post('/perspective/check', { ...lone, weight: 11 })).toEqual({ refusal: 'weight: a whole number from 1 to 10', field: 'weight' })
    expect((await post('/perspective/check', { ...lone, facet: 'harmony' })).field).toBe('facet')
    expect((await post('/perspective/format', { ...lone, state: 'maybe' })).field).toBe('state')
    expect((await answer(new Request('http://composer.test/perspective/check'))).status).toBe(405)
  })
})

describe("every Tide, at the Composer", () => {
  it('is accepted, and is formatted as the two files it is', async () => {
    const { drafts, movable } = await get('/tides.json')
    expect(drafts).toHaveLength(4)
    expect(Object.keys(movable).sort()).toEqual(['lyrics', 'melody'])
    for (const draft of drafts) {
      expect((await post('/tide/check?song=5', draft)).refusal).toBeUndefined()
      const said = await post('/tide/format', draft)
      const dir = join(import.meta.dir, '../../tides', draft.slug)
      expect(said.files).toEqual([
        { name: `${draft.slug}.actions.ts`, text: readFileSync(join(dir, 'actions.ts'), 'utf8') },
        { name: `${draft.slug}.tide.md`, text: readFileSync(join(dir, 'tide.md'), 'utf8') },
      ])
    }
  })

  it("draws the envelope as the package reads it, at the Song asked for: the curve, the cycles, and where the Song stands", async () => {
    const { drafts } = await get('/tides.json')
    const verse = drafts.find((draft: any) => draft.slug === 'verse-wordiness')
    const checked = await post('/tide/check?song=40', verse)
    const record = (await readTides()).find(({ slug }) => slug === 'verse-wordiness')!
    expect(checked.song).toBe(40)
    expect(checked.range).toEqual([0, 1])
    expect(checked.now.value).toBeCloseTo(valueAt(record, 40).value, 9)
    expect(checked.curve[0][0]).toBe(22)
    expect(checked.curve.at(-1)[0]).toBe(58)
    for (const [position, value] of checked.curve) expect(value).toBeCloseTo(valueAt(record, position).value, 9)
    // the cycles lie end to end, and the window is covered
    expect(checked.cycles.length).toBeGreaterThan(4)
    checked.cycles.slice(1).forEach((cycle: any, i: number) => expect(cycle.begins).toBe(checked.cycles[i].begins + checked.cycles[i].age))
    // an edited envelope is drawn as edited
    const higher = await post('/tide/check?song=40', { ...verse, max: 1, min: 0.5 })
    expect(Math.max(...higher.curve.map(([, value]: number[]) => value))).toBeGreaterThan(Math.max(...checked.curve.map(([, value]: number[]) => value)) - 1e-9)
  })

  it('says the field a refusal is about', async () => {
    const { drafts } = await get('/tides.json')
    const verse = drafts.find((draft: any) => draft.slug === 'verse-wordiness')
    expect(await post('/tide/check?song=1', { ...verse, max: 4 })).toEqual({ refusal: 'max: the wordiness can be 0 to 1', field: 'max' })
    expect((await post('/tide/check?song=1', { ...verse, attack: 0.9 })).field).toBe('attack')
    expect((await post('/tide/format', { ...verse, noise: 3 })).field).toBe('noise')
    expect((await post('/tide/check?song=1', { ...verse, slug: 'verse-wordiness-two' })).field).toBe('moves')
  })
})

describe('what a part counts of its lines', () => {
  it("is asked of the part, line by line, for the parameters given, and changes with them", async () => {
    const records = await readParts()
    const verse = records.find(({ part }) => part.words === 'written' && part.phrases(firstTune, { iteration: 1n, last: false }).length === 4)!.part
    const plain = await post('/measure?tempo=72', { part: verse.id, parameters: {} })
    expect(plain.lines).toHaveLength(4)
    plain.lines.forEach((line: any, i: number) => expect(line).toMatchObject({ line: i, ...verse.measure({ line: i, tune: firstTune, tempo: 72, rate: 6, parameters: {} }) }))
    const wordy = await post('/measure?tempo=72', { part: verse.id, parameters: { wordiness: 0.9 } })
    const sparse = await post('/measure?tempo=72', { part: verse.id, parameters: { wordiness: 0.1 } })
    // wordier lines are asked to carry more, and sparser ones less
    expect(wordy.lines.some((line: any, i: number) => line.target !== sparse.lines[i].target || line.most !== sparse.lines[i].most)).toBe(true)
    expect(wordy.lines.reduce((sum: number, line: any) => sum + line.target + line.most, 0)).toBeGreaterThan(sparse.lines.reduce((sum: number, line: any) => sum + line.target + line.most, 0))
    // the tempo is the tempo asked for
    expect((await post('/measure?tempo=100', { part: verse.id, parameters: {} })).lines[0].target).toBe(verse.measure({ line: 0, tune: firstTune, tempo: 100, rate: 6, parameters: {} }).target)
  })

  it('has no lines for a part with no words, and refuses a parameter out of its range, or a part that is not there', async () => {
    const records = await readParts()
    const hummed = records.find(({ part }) => part.words === 'none')!.part
    expect(await post('/measure', { part: hummed.id, parameters: {} })).toEqual({ part: hummed.id, words: 'none', lines: [] })
    const written = records.find(({ part }) => part.words === 'written')!.part
    expect((await post('/measure', { part: written.id, parameters: { wordiness: 3 } })).refusal).toContain('wordiness')
    expect((await post('/measure', { part: 'nothing', parameters: {} })).refusal).toContain('there is no part')
    expect((await answer(new Request('http://composer.test/measure'))).status).toBe(405)
  })
})
