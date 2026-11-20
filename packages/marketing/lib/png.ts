// A PNG, told to be sRGB: a browser's screenshot is 8 bits of red, green and blue to a pixel, in sRGB,
// but does not say so, and a service that wants it said (cover art is asked for in sRGB) is told here.

const table = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff
  for (const byte of bytes) c = table[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type: string, data: number[]): Uint8Array => {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Where the chunks of a PNG are, by type and in order. */
export function chunksOf(png: Uint8Array): { type: string; at: number; length: number }[] {
  if (!signature.every((byte, i) => png[i] === byte)) throw new Error('not a PNG')
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const found = []
  for (let at = 8; at < png.length; ) {
    const length = view.getUint32(at)
    found.push({ type: new TextDecoder().decode(png.subarray(at + 4, at + 8)), at, length })
    at += 12 + length
  }
  return found
}

/** The PNG with its colours said to be sRGB (perceptual) and its gamma the one sRGB has, put right after its header. Said already, it is as it was. */
export function tagSrgb(png: Uint8Array): Uint8Array {
  const chunks = chunksOf(png)
  if (chunks.some(({ type }) => type === 'sRGB' || type === 'iCCP')) return png
  const header = chunks[0]
  if (header?.type !== 'IHDR') throw new Error('a PNG begins with its header')
  const after = header.at + 12 + header.length
  const tags = [chunk('gAMA', [0x00, 0x00, 0xb1, 0x8f]), chunk('sRGB', [0])]
  return Uint8Array.from([...png.subarray(0, after), ...tags.flatMap((tag) => [...tag]), ...png.subarray(after)])
}
