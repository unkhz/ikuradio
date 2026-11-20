// Marketing: showing the Radio to people. For now, recording a Song as video.
//
//   bun marketing record --screen 1280x720 --url https://ikurad.io/s/1192/whispers-of-twilight
//                        [--promo <seconds>] [--hold 1] [--scale 1] [--out file.mp4]
//
// With --promo, the Song's promo (the page at ?promo=<seconds>); without it, the
// whole Song. The video is kept in packages/marketing/out/. It needs Chrome, and
// ffmpeg to cut and encode it; the page is shown on screen while it is recorded.

import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { capture } from './lib/capture.js'
import { addressOf, nameOf, sizeOf } from './lib/options.js'

const usage = 'bun marketing record --screen 1280x720 --url <https://ikurad.io/s/<number>/<name>> [--promo <seconds>]'
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string' },
    screen: { type: 'string', default: '1280x720' },
    promo: { type: 'string' },
    scale: { type: 'string', default: '1' },
    hold: { type: 'string', default: '1' },
    out: { type: 'string' },
  },
})
const [command] = positionals
if (command !== 'record' || !values.url) {
  console.error(usage)
  process.exit(2)
}
const promo = values.promo === undefined ? undefined : Number(values.promo)
const address = addressOf(values.url, promo)
const out = values.out ?? join(import.meta.dir, 'out', nameOf(values.url, promo))
// a promo ends by its own length; a whole Song, when it has ended
const finish = promo === undefined ? 60 * 30 : promo + 120

await capture({
  address,
  out,
  size: sizeOf(values.screen),
  scale: Number(values.scale),
  hold: Number(values.hold),
  patience: { ready: 180, finish },
})
