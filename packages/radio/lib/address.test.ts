import { expect, test } from 'bun:test'
import { addressAsked } from './address.js'

test('an address is a number and a slug', () => {
  expect(addressAsked('/s/1192/whispers-of-twilight')).toEqual({ song: '1192', slug: 'whispers-of-twilight' })
})

test("a slug's letters may be said by percent signs", () => {
  expect(addressAsked('/s/1324/silicon-serenade%C2%B2')).toEqual({ song: '1324', slug: 'silicon-serenade²' })
  expect(addressAsked('/s/7/caf%C3%A9')).toEqual({ song: '7', slug: 'café' })
})

test('what is not an address is nothing', () => {
  for (const path of ['/s/01/a', '/s/12', '/s/12/', '/s/12/-a', '/s/12/a/b', '/s/12/a%2Fb', '/s/12/%E0%A4%A', '/songs/12/a']) {
    expect(addressAsked(path)).toBeUndefined()
  }
})
