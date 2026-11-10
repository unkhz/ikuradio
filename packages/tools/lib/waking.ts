// Waking the mind. The song keeps its own mind: when it wakes, it starts
// llama.cpp's server with the model on its shelf, tuned for the machine it
// lives on, and when it rests, it lets the mind rest too. That way, one day,
// the Music can have the GPU while the mind sleeps.
//
// If a mind is already awake where the song looks for one, the song asks
// that one and leaves it alone.

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, openSync } from 'node:fs'
import { dirname } from 'node:path'
import { getEnv } from './env.js'

export type Waking = {
  /** Resolves when the mind can answer, or when the song gives up waiting. */
  ready: Promise<boolean>
  /** Lets the mind rest, if the song woke it. Resolves when it has, and the GPU is free. */
  rest(): Promise<void>
}

/** How the mind is started, for the machine the song lives on. */
export function mindArguments({
  model,
  host,
  port,
  context,
  slots,
}: {
  model: string
  host: string
  port: number
  context: number
  slots: number
}): string[] {
  return [
    ['--model', model],
    ['--host', host],
    ['--port', `${port}`],
    // every layer on the GPU
    ['--n-gpu-layers', '999'],
    ['--flash-attn', 'on'],
    // each iteration asks for five verses at once; they are answered together
    ['--parallel', `${slots}`],
    ['--ctx-size', `${context * slots}`],
    // a cache of half the size, at no cost anyone could hear
    ['--cache-type-k', 'q8_0'],
    ['--cache-type-v', 'q8_0'],
    ['--no-webui'],
  ].flat()
}

async function answers(host: string) {
  try {
    const response = await fetch(`${host}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}

/** Wakes the mind, unless it is already awake or has no model to wake with. */
export function wakeMind(log = 'memory/mind.log'): Waking {
  const { MIND_HOST, MIND_MODEL, MIND_CONTEXT, MIND_SLOTS } = getEnv()
  let child: ChildProcess | undefined

  const ready = (async () => {
    if (await answers(MIND_HOST)) return true
    if (!existsSync(MIND_MODEL)) {
      console.warn(
        `there is no mind on the shelf at ${MIND_MODEL}; the song will wait for one at ${MIND_HOST}`,
      )
      return false
    }
    const url = new URL(MIND_HOST)
    mkdirSync(dirname(log), { recursive: true })
    const out = openSync(log, 'a')
    child = spawn(
      'llama-server',
      mindArguments({
        model: MIND_MODEL,
        host: url.hostname,
        port: Number(url.port || 80),
        context: MIND_CONTEXT,
        slots: MIND_SLOTS,
      }),
      { stdio: ['ignore', out, out] },
    )
    child.on('exit', (code) => {
      if (code) console.warn(`the mind stopped (${code}); see ${log}`)
      child = undefined
    })
    // a model of a few gigabytes takes a while to settle onto the GPU
    for (let waited = 0; waited < 300 && child; waited++) {
      if (await answers(MIND_HOST)) {
        console.log(`the mind is awake: ${MIND_MODEL}`)
        return true
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    return false
  })()

  return {
    ready,
    rest() {
      const resting = child
      if (!resting || resting.exitCode !== null) return Promise.resolve()
      return new Promise<void>((resolve) => {
        resting.once('exit', () => resolve())
        resting.kill('SIGTERM')
      })
    },
  }
}
