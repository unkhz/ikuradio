import { describe, expect, it } from 'bun:test'
import { defaults, facets } from './facets.js'
import {
  describePerspectives,
  draw,
  howMany,
  perspectiveOdds,
  perspectivesFor,
  readPerspectives,
  resolve,
  type PerspectiveRecord,
} from './choose.js'

const all = readPerspectives()
/** Every Perspective as if it were active: what the Studio could draw once they have all been heard. */
const heard = all.map((r) => ({ ...r, state: 'active' as const }))

describe('the Perspectives', () => {
  it('are all records of a known Facet, with a weight', () => {
    expect(all.length).toBeGreaterThanOrEqual(13)
    for (const record of all) {
      expect(facets).toContain(record.facet)
      expect(record.weight).toBeGreaterThanOrEqual(1)
      expect(record.weight).toBeLessThanOrEqual(10)
      expect(record.title.length).toBeGreaterThan(0)
    }
  })

  it('each turn the Facet their record names, into a Setting of that Facet', async () => {
    for (const record of heard) {
      const { perspectives, settings } = await resolve([record], '7', 3)
      expect(perspectives).toEqual([
        expect.objectContaining({ slug: record.slug, facet: record.facet }),
      ])
      // only its own Facet moved
      const plain = defaults(3)
      for (const facet of facets) {
        if (facet !== record.facet) expect(settings[facet]).toEqual(plain[facet])
      }
      expect(settings[record.facet]).not.toEqual(plain[record.facet])
    }
  })

  it('turn moderately', async () => {
    for (const song of ['1', '2', '3', '40', '41']) {
      for (const record of heard) {
        const { settings } = await resolve([record], song, 3)
        expect(settings.development.ornaments).toBeLessThanOrEqual(3)
        expect(settings.development.steps).toBeLessThanOrEqual(2)
        expect(settings.choir.size).toBeGreaterThanOrEqual(1)
        expect(settings.choir.size).toBeLessThanOrEqual(4)
        expect(settings.humanness.scale).toBeGreaterThan(0)
        expect(settings.humanness.scale).toBeLessThanOrEqual(2)
        expect(settings['bridge-singers'].humming).toBeGreaterThanOrEqual(0)
        expect(settings['bridge-singers'].humming).toBeLessThanOrEqual(1)
      }
    }
  })

  it('choose a bridge bed variant from their prompts, the same for the same Song', async () => {
    const percussion = heard.find((r) => r.slug === 'bridge-beds-dramatic-percussion')!
    const one = await resolve([percussion], '12', 3)
    expect(one).toEqual(await resolve([percussion], '12', 3))
    expect(one.perspectives[0].variant).toBeTruthy()
    expect(one.settings['bridge-beds']).toEqual({
      instead: `${one.perspectives[0].variant}, percussion only, no melody`,
      // the Music still follows the guide hum: it is what keeps the drums in the Song's rhythm
      melody: true,
    })
    const variants = new Set(
      await Promise.all(['1', '2', '3', '4', '5', '6', '7', '8'].map(async (s) => (await resolve([percussion], s, 3)).perspectives[0].variant)),
    )
    expect(variants.size).toBeGreaterThan(1)
  })

  it('take the key away from a bridge in its guide, in a row of all twelve drawn for the Song', async () => {
    const atonal = heard.find((r) => r.slug === 'bridge-beds-atonal')!
    const one = await resolve([atonal], '12', 3)
    expect(one).toEqual(await resolve([atonal], '12', 3))
    const { row, melody, instead } = one.settings['bridge-beds']
    expect(melody).toBe(true)
    expect(instead).toBeUndefined()
    expect([...row!].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(one.perspectives[0].variant).toMatch(/^a row of twelve: [A-G]/)
    expect((await resolve([atonal], '13', 3)).settings['bridge-beds'].row).not.toEqual(row)
  })
})

describe('howMany', () => {
  it('hears most Songs plainly, some from one Perspective, few from two', () => {
    const counts = [0, 0, 0]
    for (let song = 1; song <= 4000; song++) counts[howMany(`${song}`)]!++
    expect(counts[0]! / 4000).toBeCloseTo(perspectiveOdds[0], 1)
    expect(counts[1]! / 4000).toBeCloseTo(perspectiveOdds[1], 1)
    expect(counts[2]! / 4000).toBeGreaterThan(0.02)
    expect(counts[2]! / 4000).toBeLessThan(0.08)
  })

  it('is the same for the same Song, and the Perspectives heard from it are as many', async () => {
    expect(howMany('160')).toBe(howMany('160'))
    const plain = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].find((song) => howMany(song) === 0)!
    expect((await perspectivesFor(plain, { choirSize: 3 })).perspectives).toEqual([])
    const one = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].find((song) => howMany(song) === 1)!
    expect((await perspectivesFor(one, { choirSize: 3 })).perspectives).toHaveLength(1)
  })

  it('does not count the Perspectives a rehearsal names', async () => {
    const plain = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].find((song) => howMany(song) === 0)!
    const named = await perspectivesFor(plain, { choirSize: 3, only: ['bridge-beds-atonal'] })
    expect(named.perspectives.map(({ slug }) => slug)).toEqual(['bridge-beds-atonal'])
  })
})

describe('draw', () => {
  it('draws only active Perspectives', () => {
    const drafts = all.map((r) => ({ ...r, state: 'draft' as const }))
    expect(draw(drafts, '1', 2)).toEqual([])
  })

  it('never puts two Perspectives on one Facet, and draws as many as asked', () => {
    for (let song = 1; song <= 200; song++) {
      const drawn = draw(heard, `${song}`, 3)
      expect(drawn).toHaveLength(3)
      expect(new Set(drawn.map((r) => r.facet)).size).toBe(3)
    }
    // with every Facet taken, no more can be drawn
    expect(draw(heard, '1', 10)).toHaveLength(facets.length)
  })

  it('is the same for the same Song', () => {
    expect(draw(heard, '42', 2)).toEqual(draw(heard, '42', 2))
  })

  it('draws the heavy more often than the light', () => {
    const counts = new Map<string, number>()
    for (let song = 1; song <= 3000; song++) {
      for (const r of draw(heard, `${song}`, 1)) counts.set(r.slug, (counts.get(r.slug) ?? 0) + 1)
    }
    const weightOf = (slug: string) => heard.find((r) => r.slug === slug)!.weight
    const heavy = heard.filter((r) => r.weight >= 6).map((r) => counts.get(r.slug) ?? 0)
    const light = heard.filter((r) => r.weight <= 2).map((r) => counts.get(r.slug) ?? 0)
    expect(Math.min(...heavy)).toBeGreaterThan(Math.max(...light))
    expect(weightOf('drift-big-turn')).toBeLessThan(weightOf('bridge-singers-often'))
  })

  it('draws nothing when no Perspective is asked for', () => {
    expect(draw(heard, '1', 0)).toEqual([])
  })
})

describe('describePerspectives', () => {
  it('says how a Song is heard', async () => {
    const records = heard.filter((r: PerspectiveRecord) => ['choir-lone', 'bridge-beds-atonal'].includes(r.slug))
    const { perspectives } = await resolve(records, '3', 3)
    expect(describePerspectives(perspectives)).toMatch(/^Atonal bridges: .+, A lone singer$|^A lone singer, Atonal bridges: .+$/)
    expect(describePerspectives([])).toBe('plainly')
  })
})
