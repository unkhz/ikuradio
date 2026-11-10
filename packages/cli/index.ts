// A listener in a terminal: the words as they are typed, and the voices and
// the Music played by ffplay, each at its moment on the listener's own clock,
// from the score it was given ahead of time. Until a score has arrived, the
// voices are played as they are cued, and the Music is not heard.

import { play } from 'vocals'
import { getEnv } from 'tools'
import { placements, type Score } from './lib/time.js'

const { SERVER_HOST, SERVER_PORT } = getEnv()

/** Recordings are fetched from the song itself, wherever it sings. */
const song = `http://${SERVER_HOST}:${SERVER_PORT}/`

/** A recording the song names, where this listener can reach it, or nothing. */
function reach(path: string) {
  return /^audio\/[\w-]+\/[\w-]+\.(m4a|mp3)$/.test(path)
    ? new URL(path, song).href
    : undefined
}

function sound(path: string, options?: { from?: number; gain?: number }) {
  const file = reach(path)
  if (!file) return
  play(file, options).catch(() => {
    // a recording let go before it could be heard; the song goes on
  })
}

const scores = new Map<string, Score>()
/** The iteration whose sounds this listener has placed itself. */
let keeping: string | undefined

function begin(iteration: string, since: number) {
  for (const name of scores.keys()) {
    if (BigInt(name) < BigInt(iteration)) scores.delete(name)
  }
  const score = scores.get(iteration)
  keeping = score ? iteration : undefined
  if (!score) return
  for (const { cue, after, from } of placements(score, since)) {
    setTimeout(() => sound(cue.file, { from, gain: cue.gain }), after * 1000)
  }
}

function hear(utterance: string) {
  if (utterance.startsWith('play:')) {
    // a listener who keeps time has placed its voices already
    if (keeping === undefined) sound(utterance.slice(5))
  } else if (utterance.startsWith('score:')) {
    const score = JSON.parse(utterance.slice(6)) as Score
    scores.set(score.iteration, score)
  } else if (utterance.startsWith('begin:')) {
    const [iteration, since] = utterance.slice(6).split('@')
    begin(iteration, Number(since ?? 0))
  } else if (utterance.startsWith('about:')) {
    const about = JSON.parse(utterance.slice(6))
    process.title = `Song that never ends, iteration ${about.iteration}`
  } else if (utterance.startsWith('rest:')) {
    process.stdout.write(`\n~ ${utterance.slice(5)} ~\n`)
  } else if (utterance.startsWith('weather:')) {
    process.stdout.write(`~ ${utterance.slice(8)} ~\n\n`)
  } else if (utterance.startsWith('part:')) {
    // a new part begins; the words already end the last one with a blank line
  } else {
    process.stdout.write(utterance === '<br>' ? '\n' : utterance)
  }
}

async function listen() {
  const response = await fetch(new URL('listen', song))
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
