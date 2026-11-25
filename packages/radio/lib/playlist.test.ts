import { describe, expect, it } from 'bun:test'
import { decodePlaylist, encodePlaylist, maxPlaylistSongs, playlistAsked, playlistJsonAsked, playlistPath } from './playlist.js'

describe('base36 numeric playlist codec', () => {
  it('round-trips single, multi-song, duplicate, and huge BigInt Song IDs as compact lowercase base36', () => {
    const cases: string[][] = [
      ['1'],
      ['42'],
      ['2177', '2178', '2179', '2180'],
      ['2169', '2174', '2177', '2177', '1'],
      ['999999999999999999999999999999', '12345678901234567890'],
    ]
    for (const ids of cases) {
      const slug = encodePlaylist(ids)
      expect(slug).toMatch(/^[0-9a-z]+$/)
      expect(decodePlaylist(slug)).toEqual(ids)
      expect(playlistPath(ids)).toBe(`/p/${slug}`)
      expect(playlistAsked(playlistPath(ids))).toBe(slug)
      expect(playlistJsonAsked(`${playlistPath(ids)}.json`)).toBe(slug)
    }
    // 4-song 4-digit playlist stays compact (~12-15 chars)
    expect(encodePlaylist([2177, 2178, 2179, 2180]).length).toBeLessThanOrEqual(16)
  })

  it('rejects malformed, non-canonical, wrong-version, truncated, overlong, or out-of-range slugs', () => {
    const valid = encodePlaylist([2177, 2178])
    expect(decodePlaylist('')).toBeUndefined()
    expect(decodePlaylist(`0${valid}`)).toBeUndefined() // non-canonical leading zero
    expect(decodePlaylist(valid.toUpperCase())).toBeUndefined() // uppercase rejected
    expect(decodePlaylist('not-base36!')).toBeUndefined()
    expect(decodePlaylist('1')).toBeUndefined() // too short (only 1 byte)
    // wrong version byte (0x02, 0x05)
    expect(decodePlaylist(((2n << 8n) | 5n).toString(36))).toBeUndefined()
    // zero ID (0x01, 0x00)
    expect(decodePlaylist(((1n << 8n) | 0n).toString(36))).toBeUndefined()
    // truncated varint (0x01, 0x81)
    expect(decodePlaylist(((1n << 8n) | 0x81n).toString(36))).toBeUndefined()
    // overlong varint (0x01, 0x85, 0x00)
    expect(decodePlaylist((((1n << 8n) | 0x85n) << 8n).toString(36))).toBeUndefined()

    // encode refuses empty, non-positive, or > maxPlaylistSongs
    expect(() => encodePlaylist([])).toThrow()
    expect(() => encodePlaylist([0])).toThrow()
    expect(() => encodePlaylist(['-5'])).toThrow()
    expect(() => encodePlaylist(Array.from({ length: maxPlaylistSongs + 1 }, (_, i) => i + 1))).toThrow()
  })

  it('matches only canonical /p/<slug> and /p/<slug>.json paths', () => {
    expect(playlistAsked('/p/ab12')).toBe('ab12')
    expect(playlistAsked('/p/ab12/extra')).toBeUndefined()
    expect(playlistAsked('/p/AB12')).toBeUndefined()
    expect(playlistAsked('/p/ab-12')).toBeUndefined()
    expect(playlistAsked('/p/ab12.json')).toBeUndefined()
    expect(playlistJsonAsked('/p/ab12.json')).toBe('ab12')
    expect(playlistJsonAsked('/p/ab12')).toBeUndefined()
  })
})
