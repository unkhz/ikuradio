import { describe, expect, it } from 'bun:test'
import type { DjDeclaration } from 'archive'
import { Introduced, saysWords, sitemapOf } from './sitemap.js'

const said = (song: string, text = 'Listen.'): DjDeclaration => ({ dj: 'rezzy', song, parts: { intro: { at: 0.9, seconds: 5, speech: { text } } } })

describe('which Songs have their intro', () => {
  it('knows a Song by words said, and not by an empty declaration', () => {
    expect(saysWords(said('1'))).toBe(true)
    expect(saysWords(said('1', '  '))).toBe(false)
    expect(saysWords({ dj: 'rezzy', song: '1', parts: {} })).toBe(false)
    expect(saysWords(undefined)).toBe(false)
  })

  it('asks about the Songs it does not know, keeps those with words, and asks no more about those', async () => {
    const asked: string[] = []
    const has = new Set(['2', '4'])
    const introduced = new Introduced()
    const declaration = async (song: string) => {
      asked.push(song)
      return has.has(song) ? said(song) : undefined
    }
    expect(await introduced.learn(['1', '2', '3', '4', '2'], declaration)).toBe(2)
    expect(asked.sort()).toEqual(['1', '2', '3', '4'])
    expect([...'1234'].map((song) => introduced.has(song))).toEqual([false, true, false, true])
    asked.length = 0
    has.add('3')
    expect(await introduced.learn(['1', '2', '3', '4'], declaration)).toBe(1)
    expect(asked.sort()).toEqual(['1', '3'])
  })

  it('tries again next time a Song cannot be asked about', async () => {
    const introduced = new Introduced()
    await introduced.learn(['5'], async () => {
      throw new Error('the Archive is away')
    })
    expect(introduced.has('5')).toBe(false)
    expect(await introduced.learn(['5'], async () => said('5'))).toBe(1)
  })
})

describe('the sitemap', () => {
  const slugs = new Map([['10', 'ten'], ['9', 'nine & more'], ['100', 'hundred'], ['11', 'eleven']])

  it('lists the Songs that have their intro and a name, newest first, and nothing else', () => {
    const introduced = new Set(['9', '10', '100', '12'])
    const map = sitemapOf('https://ikurad.io', ['9', '10', '11', '100', '12'], { has: (s) => introduced.has(s) }, slugs)
    const locs = [...map.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => loc)
    expect(locs).toEqual(['https://ikurad.io/s/100/hundred', 'https://ikurad.io/s/10/ten', 'https://ikurad.io/s/9/nine%20%26%20more'])
  })

  it('says the letters of a slug the way an address does', () => {
    const map = sitemapOf('https://ikurad.io', ['1324'], { has: () => true }, new Map([['1324', 'silicon-serenade²']]))
    expect(map).toContain('<loc>https://ikurad.io/s/1324/silicon-serenade%C2%B2</loc>')
  })

  it('is empty, and still a sitemap, while no Song has its intro', () => {
    const map = sitemapOf('https://ikurad.io', ['1'], { has: () => false }, slugs)
    expect(map).toContain('<urlset')
    expect(map).not.toContain('<loc>')
  })
})
