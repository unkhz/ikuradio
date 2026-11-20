// Marketing: showing the Radio to people.
//
//   bun marketing print <song number> <intro|name|slug|url|lyrics|meta|thoughts|tweet>
//                       [--radio https://ikurad.io] [--archive <the Archive's address>]
//
// prints a text about a Song, from what its Archive says of it. `tweet` is the intro, signed by the DJ, and the address, and nothing else.
//
//   bun marketing capture 1192 [--screen 1280x720]
//   bun marketing capture --url https://ikurad.io/s/1192/whispers-of-twilight
//                        [--promo <seconds>] [--hold 1] [--cover <seconds>] [--scale 1] [--audio-only] [--intro 0|1]
//                        [--dir <folder>] [--out <file.mp4>] [--thumbnail <image>] [--art-size 4000] [--window] [--patience 180]
//
// The video begins with --cover seconds (1 by default) of the front page, its likeness and name,
// so a platform that shows a video's first frame as its still shows the receiver.
// The file keeps a thumbnail of its own, for a player or a service to show: a picture of the front page
// (for a sound, a square of --art-size pixels, 4000 by default, drawn at that size, 24 bits to a pixel and
// said to be sRGB), or the --thumbnail image given; and the Song's name and address.
// --intro 0 leaves Rezzy's introduction out, to capture the Song alone; a sound has none by default.
// --audio-only keeps only the sound, as an mp3, for posting where there is only sound (a whole
// Song, most of all), and then has no cover and no intro.
// With --promo, the Song's promo (the page at ?promo=<seconds>); without it, the
// whole Song. The capture is kept in packages/marketing/out/, or in --dir, or exactly at --out. It needs Chrome, and
// ffmpeg to cut and encode it. Chrome runs without a window, capturing its own tab, so
// nothing is shown and no permission to watch the screen is asked for; --window shows it.
// A Song the Radio has not received yet (it holds a Song a little after the Studio has made it) is said so at once, not waited
// for; --patience is how many seconds the page may take to download the Song before the capture gives up.

import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { capture } from './lib/capture.js'
import { assets, print, urlOf, type Asset, type Song } from './lib/print.js'
import { addressOf, coverOf, nameOf, placeOf, sizeOf } from './lib/options.js'

const usage = 'bun marketing print <song number> <asset: ' + assets.join('|') + '>\n       bun marketing capture <song number | --url https://ikurad.io/s/<number>/<name>> [--screen 1280x720] [--promo <seconds>]'
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
    intro: { type: 'string' },
    thumbnail: { type: 'string' },
    'art-size': { type: 'string', default: '4000' },
    dir: { type: 'string' },
    out: { type: 'string' },
    window: { type: 'boolean', default: false },
    patience: { type: 'string', default: '180' },
  },
})
const [command, id, asset] = positionals

const archive = (values.archive ?? process.env.ARCHIVE_URL ?? process.env.ARCHIVE_PUBLIC_URL ?? 'https://hel1.your-objectstorage.com/ikuradio').replace(/\/?$/, '/')
const get = async (path: string) => {
  const response = await fetch(new URL(path, archive))
  return response.ok ? response.json() : undefined
}
const isNumber = (text?: string): text is string => text !== undefined && /^[1-9]\d*$/.test(text)

if (command === 'print') {
  if (!isNumber(id) || !assets.includes(asset as Asset)) {
    console.error(usage)
    process.exit(2)
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

// a Song is asked for by its address, or by its number, which the Radio's address is made from
const given = positionals[1]
if (command !== 'capture' || (!values.url && !isNumber(given))) {
  console.error(usage)
  process.exit(2)
}
let url = values.url
if (!url) {
  const session = await get(`sessions/${given}.json`)
  if (!session) {
    console.error(`Song ${given} is not in the Archive at ${archive}`)
    process.exit(1)
  }
  try {
    url = urlOf({ session, radio: values.radio })
  } catch (error) {
    console.error((error as Error).message)
    process.exit(1)
  }
}
const promo = values.promo === undefined ? undefined : Number(values.promo)
// Rezzy's introduction is made to be seen: a sound alone has none, unless --intro 1 asks for it, and --intro 0 leaves it out of a video
const intro = values.intro === undefined ? !values['audio-only'] : values.intro !== '0'
const address = addressOf(url, promo, { intro })
// the Radio answers 404 for a Song it has not received: say so now, instead of waiting for a page that will never be ready
const asked = await fetch(url).catch(() => undefined)
if (asked && asked.status === 404) {
  console.error(`the Radio has not received that Song yet: ${url}. It takes a little while after the Song is made; try again soon.`)
  process.exit(1)
}
// a relative --dir or --out is from where it is run: the repository's root, for `bun marketing`
const out = placeOf({ file: values.out, dir: values.dir, name: nameOf(url, promo, values['audio-only']), fallback: join(import.meta.dir, 'out'), from: process.cwd() })
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
  patience: { ready: Number(values.patience), finish },
})
// nothing is left to wait for: a browser or a child that would not stop does not keep the person waiting
process.exit(0)
