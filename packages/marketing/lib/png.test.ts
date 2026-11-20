import { expect, test } from 'bun:test'
import { chunksOf, tagSrgb } from './png.js'

// a 1x1 pixel, 8 bits of red, green and blue
const pixel = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64'))

test('a PNG is told to be sRGB right after its header, and is otherwise as it was', () => {
  const tagged = tagSrgb(pixel)
  expect(chunksOf(tagged).map(({ type }) => type)).toEqual(['IHDR', 'gAMA', 'sRGB', 'IDAT', 'IEND'])
  expect(tagged.length).toBe(pixel.length + 12 + 4 + 12 + 1)
  expect(Array.from(tagged.subarray(-12))).toEqual(Array.from(pixel.subarray(-12)))
})

test('one that says it already is not told again', () => {
  const tagged = tagSrgb(pixel)
  expect(tagSrgb(tagged)).toBe(tagged)
})

test('what is not a PNG is not touched', () => {
  expect(() => tagSrgb(Uint8Array.from([1, 2, 3]))).toThrow('not a PNG')
})
