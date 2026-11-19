// The speaking throat, in the Studio (plan "Intro with Rezzy"): the same
// WebAssembly a Receiver says a DJ's words with, built apart from the throat
// the choir sings with. The Studio does not record the speech: it only says
// it, to hear how long it lasts, and fit it to the room the intro leaves.

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import type { Request, Said } from 'dj'

const page = new URL('../../ui/public/', import.meta.url).pathname
const speech = `${page}throat/speech/`

type Engine = { say(request: Request): { samples: Float32Array; end: number; segments: unknown[] } }

let opened: Promise<Engine> | undefined

/** Opens the speaking throat, once, from the files `bun run throat` leaves beside the Receiver's page. */
export function openSpeaking(): Promise<Engine> {
  opened ??= (async () => {
    const { openSpeech } = (await import(`${page}speech.js`)) as { openSpeech(engine: Uint8Array, dictionary: string): Promise<Engine> }
    return openSpeech(readFileSync(`${speech}chimera.wasm`), gunzipSync(readFileSync(`${speech}cmudict.txt.gz`)).toString())
  })()
  return opened
}

/** Says a request, and tells how long the speech is. */
export const saying = async (request: Request): Promise<Said> => ({ end: (await openSpeaking()).say(request).end })
