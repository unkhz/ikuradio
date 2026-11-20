import { expect, test } from 'bun:test'
import { addressOf, coverOf, cutArgs, nameOf, placeOf, sizeOf, textOf } from './options.js'

test('a size is width and height', () => {
  expect(sizeOf('1080x1920')).toEqual({ width: 1080, height: 1920 })
  expect(() => sizeOf('big')).toThrow()
})

test('a promo is asked for with its length in the Song\'s own address, a whole Song without', () => {
  const song = 'http://localhost:3101/s/1192/whispers-of-twilight'
  expect(addressOf(song, 45)).toBe(`${song}?promo=45`)
  expect(addressOf(song)).toBe(`${song}?promo=0`)
  expect(addressOf(song, 0, { intro: false })).toBe(`${song}?promo=0&intro=0`)
  expect(addressOf(song, 30, { intro: false })).toBe(`${song}?promo=30&intro=0`)
  expect(() => addressOf(song, 5)).toThrow()
  expect(() => addressOf('http://localhost:3101/')).toThrow()
})

test('a capture is named by its Song, and by the length of its promo if it is one', () => {
  const song = 'https://ikurad.io/s/1192/whispers-of-twilight'
  expect(nameOf(song, 45)).toBe('ikuradio-1192-whispers-of-twilight-45s.mp4')
  expect(nameOf(song)).toBe('ikuradio-1192-whispers-of-twilight.mp4')
  expect(nameOf('https://ikurad.io/s/1324/silicon-serenade%C2%B2', 0, false, 'png')).toBe('ikuradio-1324-silicon-serenade².png')
  expect(nameOf(song, 0)).toBe('ikuradio-1192-whispers-of-twilight.mp4')
  // a whole Song is named the same with or without its intro
  expect(nameOf(song, 0, true)).toBe('ikuradio-1192-whispers-of-twilight.mp3')
})

test('the capture is cut from the moment the front page went', () => {
  const args = cutArgs('raw.webm', 1.25, 'out.mp4', { width: 1280, height: 720 })
  expect(args.slice(args.indexOf('-ss'), args.indexOf('-ss') + 2)).toEqual(['-ss', '1.250'])
  expect(args).toContain('scale=1280:720:flags=lanczos')
  expect(args.at(-1)).toBe('out.mp4')
})

test('a capture is kept in the folder asked for, under its own name, or in the file asked for', () => {
  const name = 'song-1192-promo-45s.mp4'
  expect(placeOf({ dir: 'clips', name, fallback: '/pkg/out', from: '/work' })).toBe(`/work/clips/${name}`)
  expect(placeOf({ dir: '/elsewhere', name, fallback: '/pkg/out', from: '/work' })).toBe(`/elsewhere/${name}`)
  expect(placeOf({ name, fallback: '/pkg/out', from: '/work' })).toBe(`/pkg/out/${name}`)
  expect(placeOf({ file: 'a.mp4', dir: 'clips', name, fallback: '/pkg/out', from: '/work' })).toBe('/work/a.mp4')
})

test('a sound alone is an mp3 with no picture, and has no cover unless asked for', () => {
  expect(nameOf('https://ikurad.io/s/1192/whispers-of-twilight', undefined, true)).toBe('ikuradio-1192-whispers-of-twilight.mp3')
  const args = cutArgs('raw.webm', 0, 'out.mp3', { width: 1280, height: 720 }, true)
  expect(args.join(' ')).toContain('-map 0:a')
  expect(args).not.toContain('libx264')
  expect(coverOf(undefined, true)).toBe(0)
  expect(coverOf(undefined, false)).toBe(1)
  expect(coverOf('2', true)).toBe(2)
})

test('a thumbnail is kept in the file as its attached picture, and the cut is of the video alone', () => {
  const args = cutArgs('raw.webm', 1, 'out.mp4', { width: 1280, height: 720 }, false, { thumbnail: 'still.png', title: 'Whispers', comment: 'https://ikurad.io/s/1/w' })
  // the cut is before the first input, so the thumbnail's one moment is not cut away
  expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
  expect(args).toContain('still.png')
  expect(args.join(' ')).toContain('-disposition:v:1 attached_pic')
  expect(args).toContain('title=Whispers')
})

test('a sound has the thumbnail as its cover', () => {
  const args = cutArgs('raw.webm', 0, 'out.mp3', { width: 1280, height: 720 }, true, { thumbnail: 'still.png' })
  expect(args.join(' ')).toContain('-map 1:v -c:v copy')
  expect(args).not.toContain('libx264')
})

test('textOf leaves the page its own text at scale 1, and keeps what the whole screen would give it at a larger one', () => {
  expect(textOf({ width: 1080, height: 1920 }, 1)).toBe('')
  expect(textOf({ width: 1080, height: 1920 }, 2)).toContain('font-size: 28px')
  expect(textOf({ width: 400, height: 800 }, 2)).toContain('font-size: 16px')
})
