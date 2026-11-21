import { describe, expect, it } from 'bun:test'
import { modes } from 'melody'
import { fastest, firstMood, slowest, stride, weather } from 'mood'
import { defaults, readPerspectives } from 'perspectives'
import { positionOf, readTides, validRange, valueAt } from 'tides'
import { composer } from './serve.js'
import { moodAnswer, perspectivesAnswer, tidesAnswer } from './shaping.js'

const get = (path: string) => composer()(new Request(`http://composer.test${path}`))

type Leaf = { name: string; path: string[]; value: unknown; perspectives: string[]; tides: string[] }
type Node = { name: string; children: (Node | Leaf)[] }
const leavesOf = (node: Node | Leaf): Leaf[] => ('children' in node ? node.children.flatMap(leavesOf) : [node])
const leavesOfSettings = (value: unknown, path: string[] = []): string[] =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length
    ? Object.entries(value).flatMap(([key, child]) => leavesOfSettings(child, [...path, key]))
    : [path.join('.')]

describe('the Mood', () => {
  it("is the package's own: the first Mood, the weather, the modes and the tempo", () => {
    const answer = moodAnswer()
    expect(answer.first.descriptions).toEqual(firstMood.descriptions)
    expect(answer.first.character).toEqual(firstMood.character)
    expect(answer.weather).toEqual([...weather])
    expect(answer.modes.map(({ name }) => name)).toEqual(Object.keys(modes))
    for (const mode of answer.modes) expect(mode.degrees).toEqual([...modes[mode.name as keyof typeof modes]])
    expect(answer.tempo).toEqual({ slowest, fastest, stride })
    // a mode is a scale of seven degrees within an octave, beginning on the tonic
    for (const mode of answer.modes) {
      expect(mode.degrees).toHaveLength(7)
      expect(mode.degrees[0]).toBe(0)
      expect(Math.max(...mode.degrees)).toBeLessThan(12)
    }
    expect(answer.born.tempo).toBeGreaterThanOrEqual(slowest)
    expect(answer.born.tempo).toBeLessThanOrEqual(fastest)
  })
})

describe('the Perspectives', () => {
  it('has every Perspective there is, with its record and its weight', async () => {
    const answer = await perspectivesAnswer()
    const records = readPerspectives()
    expect(answer.perspectives.map(({ slug }) => slug)).toEqual(records.map(({ slug }) => slug))
    for (const [i, shown] of answer.perspectives.entries()) {
      expect(shown.facet).toBe(records[i]!.facet)
      expect(shown.weight).toBe(records[i]!.weight)
      expect(shown.title).toBe(records[i]!.title)
      expect(shown.text.length).toBeGreaterThan(10)
    }
    expect(answer.weight).toBe(records.filter((r) => r.state === 'active').reduce((sum, r) => sum + r.weight, 0))
  })

  it('says what each turns, from the defaults, and how far', async () => {
    const { perspectives } = await perspectivesAnswer()
    const choir = perspectives.find(({ slug }) => slug === 'bridge-singers-choir')!
    expect(choir.turns).toEqual([{ path: ['bridge-singers', 'choir'], before: false, after: true }])
    // every Perspective turns only within its own Facet
    for (const shown of perspectives) for (const turn of shown.turns) expect(turn.path[0]).toBe(shown.facet)
    // and all but one turn something from the defaults: a lone choir is what a choir of one already is
    expect(perspectives.filter(({ turns }) => !turns.length).map(({ slug }) => slug)).toEqual(['choir-lone'])
  })

  it('shows the Settings as a tree, every leaf of the defaults once, with who can move it', async () => {
    const { settings, perspectives } = await perspectivesAnswer()
    const leaves = leavesOf(settings)
    expect(leaves.map(({ path }) => path.join('.')).sort()).toEqual(leavesOfSettings(defaults(1)).sort())
    const choirSize = leaves.find(({ path }) => path.join('.') === 'choir.size')!
    expect(choirSize.perspectives.sort()).toEqual(perspectives.filter((p) => p.facet === 'choir').map((p) => p.slug).sort())
    // a leaf of one part is moved only by what is kept for that part, and by the Tide that moves it
    const verseWordiness = leaves.find(({ path }) => path.join('.') === 'lyrics.verse.wordiness')!
    expect(verseWordiness.tides).toEqual(['verse-wordiness'])
    expect(leaves.find(({ path }) => path.join('.') === 'melody.chorus.ceiling')!.tides).toEqual(['chorus-ceiling'])
  })
})

describe('the Tides', () => {
  it('has every Tide, its range the package own, its curve within it, and where it stands now', async () => {
    const answer = await tidesAnswer(1461)
    const records = await readTides()
    expect(answer.tides.map(({ slug }) => slug)).toEqual(records.map(({ slug }) => slug))
    expect(answer.song).toBe(1461)
    expect(answer.window).toEqual([1443, 1479])
    for (const [i, shown] of answer.tides.entries()) {
      const record = records[i]!
      expect(shown.moves).toEqual(record.moves)
      expect(shown.range).toEqual([...validRange[record.moves.setting]])
      expect(shown.curve[0]![0]).toBe(1443)
      expect(shown.curve.at(-1)![0]).toBe(1479)
      for (const [, value] of shown.curve) {
        expect(value).toBeGreaterThanOrEqual(shown.range[0]! - 1e-9)
        expect(value).toBeLessThanOrEqual(shown.range[1]! + 1e-9)
      }
      expect(shown.now.value).toBe(valueAt(record, positionOf(1461n, 0, 1)).value)
      expect(shown.envelope).toMatchObject({ min: record.min, max: record.max, attack: record.attack })
    }
  })

  it('draws the same curve for the same Song, and another around another Song', async () => {
    expect(await tidesAnswer(7)).toEqual(await tidesAnswer(7))
    expect((await tidesAnswer(7)).window).toEqual([0, 25])
  })
})

describe('the pages of what shapes a Song', () => {
  it('answer as JSON at the concepts\' own addresses', async () => {
    expect(((await (await get('/mood.json')).json()) as { tempo: { slowest: number } }).tempo.slowest).toBe(slowest)
    expect(((await (await get('/perspectives.json')).json()) as { perspectives: unknown[] }).perspectives.length).toBe(readPerspectives().length)
    expect(((await (await get('/tides.json?song=77')).json()) as { song: number }).song).toBe(77)
    expect(((await (await get('/tides.json?song=nonsense')).json()) as { song: number }).song).toBe(1)
  })
})
