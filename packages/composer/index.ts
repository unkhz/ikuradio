// The Composer (plan "Evolution of Song"): the scientist's place to see the concepts of a Song, and to change its Arrangements.
// It needs no mind and no music, and runs anywhere: on the Mac, or on xitra.
//
//   bun run composer            # on COMPOSER_PORT, 3200 by default

import { readConcepts } from './lib/concepts.js'
import { composer } from './lib/serve.js'

// a folder of concepts that is not whole is said now, loudly, and the Composer does not start
await readConcepts()
const port = Number(process.env.COMPOSER_PORT ?? 3200)
Bun.serve({ port, fetch: composer() })
console.log(`The Composer is at http://localhost:${port}`)
