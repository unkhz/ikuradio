import { describe, expect, it } from 'bun:test'
import { fromOutline, hex } from './field.js'
import { ico } from './ico.js'
import { lettersAcross, lettersDown, spell } from './letters.js'
import { sample, within } from './matrix.js'

describe('the display', () => {
  it('spells a word five dots to a letter, with a dark column between letters', () => {
    const lit = spell('ikuradio')
    expect(lit).toHaveLength(lettersDown)
    for (const row of lit) expect(row).toHaveLength(8 * lettersAcross + 7)
    // the dot over the first i, and the dark column after it
    expect(lit[0]![2]).toBe(true)
    expect(lit.every((row) => !row[lettersAcross])).toBe(true)
  })

  it('cannot spell a letter it has never needed', () => {
    expect(() => spell('song')).toThrow('no letter "s"')
  })
})

describe('the matrix', () => {
  const white = hex('#ffffff')
  const square = fromOutline([
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ])
  const field = (x: number, y: number) => (square([x, y]) < 0 ? { color: white, energy: 1 } : undefined)

  it('sees a whole cell, so a cell half covered is half lit', () => {
    expect(within(field, 0, 0, 10)?.energy).toBe(1)
    expect(within(field, 5, 0, 10)?.energy).toBe(0.5)
    expect(within(field, 20, 20, 10)).toBeUndefined()
  })

  it('draws a fuller dot for more light, and none where there is none', () => {
    const dots = sample(field, { columns: 3, rows: 1, from: [0, 0], step: 5, pitch: 10, smallest: 0, largest: 0.5 })
    expect(dots.map((d) => d.r)).toEqual([5, 5])
    expect(dots[0]!.color).toBe('#ffffff')
  })

  it('shows the unlit dots, if asked, as an unlit display does', () => {
    const unlit = { color: hex('#102030'), energy: 0 }
    const dots = sample(field, { columns: 3, rows: 1, from: [0, 0], step: 5, pitch: 10, smallest: 0.1, unlit })
    expect(dots).toHaveLength(3)
    expect(dots[2]).toEqual({ x: 25, y: 5, r: 1, color: '#102030' })
  })
})

describe('the icon file', () => {
  it('lists each picture by its size, then carries them as they are', () => {
    const png = (size: number) => {
      const bytes = new Uint8Array(24)
      new DataView(bytes.buffer).setUint32(16, size)
      return bytes
    }
    const file = ico([png(16), png(256)])
    const view = new DataView(file.buffer)
    expect(view.getUint16(4, true)).toBe(2)
    expect(file[6]).toBe(16)
    expect(file[22]).toBe(0)
    expect(view.getUint32(6 + 12, true)).toBe(38)
    expect(view.getUint32(22 + 12, true)).toBe(62)
    expect(file.length).toBe(38 + 48)
  })
})
