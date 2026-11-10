// A listener in a terminal: the words as they are typed, and the voices
// played by ffplay as they are cued. It does not keep time itself; it trusts
// the cues, which is good enough for a terminal on the same machine as the
// song.

import { play } from 'vocals'
import { getEnv } from 'tools'

const { SERVER_HOST, SERVER_PORT } = getEnv()

/** Recordings live with the server; this listener reaches them from next door. */
const recordings = new URL('../server/', import.meta.url)

function hear(utterance: string) {
  if (utterance.startsWith('play:')) {
    const path = utterance.slice(5)
    if (/^audio\/[\w-]+\/[\w-]+\.(m4a|mp3)$/.test(path)) {
      play(new URL(path, recordings).pathname).catch(() => {
        // a recording let go before it could be heard; the song goes on
      })
    }
  } else if (/^(score|begin):/.test(utterance)) {
    // for listeners who keep their own time
  } else {
    process.stdout.write(utterance === '<br>' ? '\n' : utterance)
  }
}

async function listen() {
  const response = await fetch(`http://${SERVER_HOST}:${SERVER_PORT}`)
  if (!response.body) return
  const decoder = new TextDecoder()
  let unfinished = ''
  for await (const chunk of response.body) {
    const utterances = (
      unfinished + decoder.decode(chunk, { stream: true })
    ).split('\n')
    unfinished = utterances.pop() ?? ''
    utterances.forEach(hear)
  }
}

listen()
