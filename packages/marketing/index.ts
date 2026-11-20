// Marketing: showing the Radio to people. For now, capturing a Song as video.
//
//   bun marketing capture --screen 1280x720 --url https://ikurad.io/s/1192/whispers-of-twilight
//                        [--promo <seconds>] [--hold 1] [--scale 1]
//                        [--dir <folder>] [--out <file.mp4>] [--window]
//
// With --promo, the Song's promo (the page at ?promo=<seconds>); without it, the
// whole Song. The capture is kept in packages/marketing/out/, or in --dir, or exactly at --out. It needs Chrome, and
// ffmpeg to cut and encode it. Chrome runs without a window, capturing its own tab, so
// nothing is shown and no permission to watch the screen is asked for; --window shows it.

import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { capture } from './lib/capture.js'
import { addressOf, nameOf, placeOf, sizeOf } from './lib/options.js'

const usage = 'bun marketing capture --screen 1280x720 --url <https://ikurad.io/s/<number>/<name>> [--promo <seconds>]'
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string' },
    screen: { type: 'string', default: '1280x720' },
    promo: { type: 'string' },
    scale: { type: 'string', default: '1' },
    hold: { type: 'string', default: '1' },
    dir: { type: 'string' },
    out: { type: 'string' },
    window: { type: 'boolean', default: false },
  },
})
const [command] = positionals
if (command !== 'capture' || !values.url) {
  console.error(usage)
  process.exit(2)
}
const promo = values.promo === undefined ? undefined : Number(values.promo)
const address = addressOf(values.url, promo)
// a relative --dir or --out is from where it is run: the repository's root, for `bun marketing`
const out = placeOf({ file: values.out, dir: values.dir, name: nameOf(values.url, promo), fallback: join(import.meta.dir, 'out'), from: process.cwd() })
// a promo ends by its own length; a whole Song, when it has ended
const finish = promo === undefined ? 60 * 30 : promo + 120

await capture({
  address,
  out,
  size: sizeOf(values.screen),
  scale: Number(values.scale),
  hold: Number(values.hold),
  headless: !values.window,
  patience: { ready: 180, finish },
})
