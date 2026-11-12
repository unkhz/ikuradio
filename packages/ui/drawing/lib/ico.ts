// An .ico, the old way a browser's tab is given its little picture: a short
// header, then the same picture at a few sizes, each kept as a PNG.

export function ico(pngs: readonly Uint8Array[]): Uint8Array {
  const header = 6 + 16 * pngs.length
  const out = new Uint8Array(header + pngs.reduce((sum, png) => sum + png.length, 0))
  const view = new DataView(out.buffer)
  view.setUint16(2, 1, true)
  view.setUint16(4, pngs.length, true)
  let offset = header
  pngs.forEach((png, i) => {
    const size = new DataView(png.buffer, png.byteOffset).getUint32(16)
    const entry = 6 + 16 * i
    out[entry] = size >= 256 ? 0 : size
    out[entry + 1] = size >= 256 ? 0 : size
    view.setUint16(entry + 4, 1, true)
    view.setUint16(entry + 6, 32, true)
    view.setUint32(entry + 8, png.length, true)
    view.setUint32(entry + 12, offset, true)
    out.set(png, offset)
    offset += png.length
  })
  return out
}
