import { expect, test } from 'bun:test'
import { addressOf, cutArgs, nameOf, sizeOf } from './options.js'

test('a size is width and height', () => {
  expect(sizeOf('1080x1920')).toEqual({ width: 1080, height: 1920 })
  expect(() => sizeOf('big')).toThrow()
})

test('a promo is asked for with its length in the Song\'s own address, a whole Song without', () => {
  const song = 'http://localhost:3101/s/1192/whispers-of-twilight'
  expect(addressOf(song, 45)).toBe(`${song}?promo=45`)
  expect(addressOf(`${song}?promo=10`)).toBe(song)
  expect(() => addressOf(song, 5)).toThrow()
  expect(() => addressOf('http://localhost:3101/')).toThrow()
})

test('a capture is named by its Song and what it holds', () => {
  const song = 'https://ikurad.io/s/1192/whispers-of-twilight'
  expect(nameOf(song, 45)).toBe('song-1192-promo-45s.mp4')
  expect(nameOf(song)).toBe('song-1192-whole.mp4')
})

test('the capture is cut from the moment the front page went', () => {
  const args = cutArgs('raw.webm', 1.25, 'out.mp4', { width: 1280, height: 720 })
  expect(args.slice(args.indexOf('-ss'), args.indexOf('-ss') + 2)).toEqual(['-ss', '1.250'])
  expect(args).toContain('scale=1280:720:flags=lanczos')
  expect(args.at(-1)).toBe('out.mp4')
})
