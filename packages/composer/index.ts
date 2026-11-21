// The Composer (plan "Evolution of Song"): the scientist's place to see the parts and the Arrangements of a Song.
// It needs no mind and no music, and runs anywhere: on the Mac, or on xitra.
//
//   bun run composer            # on COMPOSER_PORT, 3200 by default

import { composer } from './lib/serve.js'

const port = Number(process.env.COMPOSER_PORT ?? 3200)
Bun.serve({ port, fetch: composer() })
console.log(`The Composer is at http://localhost:${port}`)
