// Marketing: showing the Radio to people.
//
//   bun marketing print <song number> <intro|name|slug|url|lyrics|meta|thoughts|tweet>
//                       [--radio https://ikurad.io] [--archive <the Archive's address>]
//
// prints a text about a Song, from what its Archive says of it. `tweet` is the intro and the address, and nothing else.
//
//   bun marketing capture --screen 1280x720 --url https://ikurad.io/s/1192/whispers-of-twilight
//                        [--promo <seconds>] [--hold 1] [--cover <seconds>] [--scale 1] [--audio-only]
//                        [--dir <folder>] [--out <file.mp4>] [--thumbnail <image>] [--art-size 4000] [--window]
//
// The video begins with --cover seconds (1 by default) of the front page, its likeness and name,
// so a platform that shows a video's first frame as its still shows the receiver.
// The file keeps a thumbnail of its own, for a player or a service to show: a picture of the front page
// (for a sound, a square of --art-size pixels, 4000 by default, drawn at that size, 24 bits to a pixel and
// said to be sRGB), or the --thumbnail image given; and the Song's name and address.
// --audio-only keeps only the sound, as an mp3, for posting where there is only sound (a whole
// Song, most of all), and then has no cover and no intro.
// With --promo, the Song's promo (the page at ?promo=<seconds>); without it, the
// whole Song. The capture is kept in packages/marketing/out/, or in --dir, or exactly at --out. It needs Chrome, and
// ffmpeg to cut and encode it. Chrome runs without a window, capturing its own tab, so
// nothing is shown and no permission to watch the screen is asked for; --window shows it.

import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { capture } from './lib/capture.js'
import { assets, print, type Asset, type Song } from './lib/print.js'
import { addressOf, coverOf, nameOf, placeOf, sizeOf } from './lib/options.js'

const usage = 'bun marketing print <song number> <asset: ' + assets.join('|') + '>\n       bun marketing capture --screen 1280x720 --url <https://ikurad.io/s/<number>/<name>> [--promo <seconds>]'
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string' },
    radio: { type: 'string', default: 'https://ikurad.io' },
    archive: { type: 'string' },
    screen: { type: 'string', default: '1280x720' },
    promo: { type: 'string' },
    scale: { type: 'string', default: '1' },
    hold: { type: 'string', default: '1' },
    cover: { type: 'string' },
    'audio-only': { type: 'boolean', default: false },
    thumbnail: { type: 'string' },
    'art-size': { type: 'string', default: '4000' },
    dir: { type: 'string' },
    out: { type: 'string' },
    window: { type: 'boolean', default: false },
  },
})
const [command, id, asset] = positionals

if (command === 'print') {
  if (!id || !/^[1-9]\d*$/.test(id) || !assets.includes(asset as Asset)) {
    console.error(usage)
    process.exit(2)
  }
  const archive = (values.archive ?? process.env.ARCHIVE_URL ?? process.env.ARCHIVE_PUBLIC_URL ?? 'https://hel1.your-objectstorage.com/ikuradio').replace(/\/?$/, '/')
  const get = async (path: string) => {
    const response = await fetch(new URL(path, archive))
    return response.ok ? response.json() : undefined
  }
  const session = await get(`sessions/${id}.json`)
  if (!session) {
    console.error(`Song ${id} is not in the Archive at ${archive}`)
    process.exit(1)
  }
  const song: Song = { session, dj: await get(`sessions/dj-rezzy-${id}.json`), radio: values.radio }
  try {
    const text = print(song, asset as Asset)
    console.log(text)
  } catch (error) {
    console.error((error as Error).message)
    process.exit(1)
  }
  process.exit(0)
}

if (command !== 'capture' || !values.url) {
  console.error(usage)
  process.exit(2)
}
const promo = values.promo === undefined ? undefined : Number(values.promo)
// a sound alone has no use for Rezzy's introduction, which is made to be seen
const address = addressOf(values.url, promo, { intro: !values['audio-only'] })
// a relative --dir or --out is from where it is run: the repository's root, for `bun marketing`
const out = placeOf({ file: values.out, dir: values.dir, name: nameOf(values.url, promo, values['audio-only']), fallback: join(import.meta.dir, 'out'), from: process.cwd() })
// a promo ends by its own length; a whole Song (no promo, or `--promo 0`), when it has ended
const finish = promo ? promo + 120 : 60 * 30

await capture({
  address,
  out,
  size: sizeOf(values.screen),
  scale: Number(values.scale),
  hold: Number(values.hold),
  cover: coverOf(values.cover, values['audio-only']),
  audioOnly: values['audio-only'],
  thumbnail: values.thumbnail && resolve(process.cwd(), values.thumbnail),
  artSize: Number(values['art-size']),
  headless: !values.window,
  patience: { ready: 180, finish },
})
// nothing is left to wait for: a browser or a child that would not stop does not keep the person waiting
process.exit(0)
