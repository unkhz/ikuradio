import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { perspectivesHome } from './choose.js'
import { fileOf, formatPerspective, refusePerspective, type PerspectiveFile } from './record.js'

const folders = readdirSync(perspectivesHome, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== 'lib' && entry.name !== 'node_modules')
const textOf = (slug: string) => readFileSync(join(perspectivesHome, slug, 'perspective.md'), 'utf8')

describe("every Perspective's record", () => {
  it('is accepted, and is formatted as the file it is', async () => {
    expect(folders.length).toBeGreaterThan(20)
    for (const { name } of folders) {
      const text = textOf(name)
      const file = fileOf(text)
      expect(file.slug).toBe(name)
      expect(await refusePerspective(file)).toBeUndefined()
      expect(formatPerspective(file)).toBe(text)
    }
  })

  it('changes in the one line it is changed in: a weight, a state, a word', () => {
    const text = textOf('choir-lone')
    const file = fileOf(text)
    const changed = formatPerspective({ ...file, weight: 7, state: 'retired', body: file.body.replace('One singer', 'A single singer') })
    const was = text.split('\n')
    const now = changed.split('\n')
    expect(now).toHaveLength(was.length)
    expect(now.flatMap((line, i) => (line === was[i] ? [] : [line]))).toEqual(['weight: 7', 'state: retired', 'A single singer, no choir: the lead sings everything alone, the chorus too.'])
  })
})

describe('what is refused of a record', () => {
  const good = (): PerspectiveFile => fileOf(textOf('progression-walking-verses'))
  it('says the field, and what is wrong with it', async () => {
    expect(await refusePerspective({ ...good(), weight: 11 })).toBe('weight: a whole number from 1 to 10')
    expect(await refusePerspective({ ...good(), weight: 2.5 })).toContain('weight:')
    expect(await refusePerspective({ ...good(), facet: 'nothing' })).toContain('facet: it is one of')
    expect(await refusePerspective({ ...good(), state: 'maybe' })).toContain('state:')
    expect(await refusePerspective({ ...good(), part: 'coda' })).toContain('part: it is one of')
    expect(await refusePerspective({ ...fileOf(textOf('choir-lone')), part: 'verse' })).toContain('the choir Facet is not kept for each part')
    expect(await refusePerspective({ ...good(), slug: 'Bad Slug' })).toContain('slug:')
    expect(await refusePerspective({ ...good(), id: 0 })).toContain('id:')
  })

  it("is refused for a Facet its Turn does not turn, and not for a Perspective whose Turn is not written yet", async () => {
    expect(await refusePerspective({ ...fileOf(textOf('choir-lone')), facet: 'harmony' })).toBe('facet: its Turn, in actions.ts, turns choir')
    expect(await refusePerspective({ ...fileOf(textOf('choir-lone')), slug: 'choir-new', facet: 'harmony' })).toBeUndefined()
  })
})
