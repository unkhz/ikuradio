// Base36 numeric playlist codec for `/p/<slug>`.
//
// Encodes an ordered list of positive numerical Song IDs (arbitrary-precision
// BigInts) into a compact, opaque lowercase base36 string:
//   [versionByte = 0x01, ...LEB128(id_0), ...LEB128(id_1), ...] -> BigInt -> base36
//
// Because the version byte is non-zero (0x01), the leading byte is never lost
// when packed as a big-endian unsigned BigInt. Decoding validates canonical
// lowercase base36, version byte, non-overlong LEB128 varints, positive IDs
// within ikuradio's 400-digit bound, and playlist length bounds.

/** Format version byte prepended before the LEB128 varint stream. */
const VERSION = 1

/** Maximum number of Songs allowed in a single playlist URL. */
export const maxPlaylistSongs = 64

/** Maximum Song ID accepted (matches ikuradio's 400-digit Song number limit). */
const maxSongId = 10n ** 400n - 1n

/** Maximum accepted base36 slug length. */
const maxSlugLength = 512

const base36Pattern = /^[0-9a-z]+$/

function parsePositiveBigInt(value: bigint | number | string): bigint {
  if (typeof value === 'bigint') {
    if (value < 1n || value > maxSongId) throw new Error(`Song ID out of range: ${value}`)
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Song ID must be a positive integer: ${value}`)
    return BigInt(value)
  }
  const trimmed = value.trim()
  if (!/^[1-9]\d{0,399}$/.test(trimmed)) throw new Error(`Song ID must be a positive decimal integer: "${value}"`)
  return BigInt(trimmed)
}

function encodeVarint(value: bigint, out: number[]): void {
  let n = value
  do {
    let byte = Number(n & 0x7fn)
    n >>= 7n
    if (n > 0n) byte |= 0x80
    out.push(byte)
  } while (n > 0n)
}

function parseBase36(slug: string): bigint | undefined {
  if (!slug || slug.length > maxSlugLength || !base36Pattern.test(slug)) return undefined
  let acc = 0n
  for (let i = 0; i < slug.length; i++) {
    const code = slug.charCodeAt(i)
    const digit = code <= 57 ? code - 48 : code - 87
    acc = acc * 36n + BigInt(digit)
  }
  // reject non-canonical leading zeros (e.g. "00abc")
  if (acc.toString(36) !== slug) return undefined
  return acc
}

/** Encodes a non-empty list of positive numeric Song IDs into a canonical lowercase base36 playlist slug. */
export function encodePlaylist(ids: readonly (bigint | number | string)[]): string {
  if (ids.length === 0) throw new Error('a playlist must contain at least one Song ID')
  if (ids.length > maxPlaylistSongs) throw new Error(`a playlist may contain at most ${maxPlaylistSongs} Songs`)
  const bytes: number[] = [VERSION]
  for (const raw of ids) encodeVarint(parsePositiveBigInt(raw), bytes)
  let packed = 0n
  for (const b of bytes) packed = (packed << 8n) | BigInt(b)
  const slug = packed.toString(36)
  if (slug.length > maxSlugLength) throw new Error(`encoded playlist exceeds ${maxSlugLength} characters`)
  return slug
}

/**
 * Decodes a base36 playlist slug back into ordered decimal Song ID strings, or
 * returns `undefined` if the slug is malformed, non-canonical, or out of range.
 */
export function decodePlaylist(slug: string): string[] | undefined {
  const packed = parseBase36(slug)
  if (packed === undefined || packed <= 0n) return undefined
  const bytes: number[] = []
  let n = packed
  while (n > 0n) {
    bytes.push(Number(n & 0xffn))
    n >>= 8n
  }
  bytes.reverse()
  if (bytes.length < 2 || bytes[0] !== VERSION) return undefined

  const ids: string[] = []
  let i = 1
  while (i < bytes.length) {
    let value = 0n
    let shift = 0n
    let started = i
    let done = false
    while (i < bytes.length) {
      const b = bytes[i++]!
      const low = BigInt(b & 0x7f)
      // reject non-canonical overlong varint (trailing 0x00 byte on multi-byte value)
      if ((b & 0x80) === 0 && i - started > 1 && low === 0n) return undefined
      value |= low << shift
      shift += 7n
      if (value > maxSongId) return undefined
      if ((b & 0x80) === 0) {
        done = true
        break
      }
    }
    if (!done || value < 1n) return undefined
    ids.push(value.toString())
    if (ids.length > maxPlaylistSongs) return undefined
  }
  return ids.length ? ids : undefined
}

/** Matches `/p/<slug>` page paths and returns the raw slug, or `undefined`. */
export function playlistAsked(pathname: string): string | undefined {
  const match = /^\/p\/([0-9a-z]{2,512})$/.exec(pathname)
  return match ? match[1] : undefined
}

/** Matches `/p/<slug>.json` API paths and returns the raw slug, or `undefined`. */
export function playlistJsonAsked(pathname: string): string | undefined {
  const match = /^\/p\/([0-9a-z]{2,512})\.json$/.exec(pathname)
  return match ? match[1] : undefined
}

/** Builds the canonical `/p/<slug>` path for a list of numeric Song IDs. */
export const playlistPath = (ids: readonly (bigint | number | string)[]): string => `/p/${encodePlaylist(ids)}`
