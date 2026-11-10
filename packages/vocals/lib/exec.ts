import { spawn } from 'node:child_process'
import { availableParallelism, setPriority } from 'node:os'

/** How much lower than everything else the song's own work runs. */
const gentleness = 10

/**
 * Runs a program to its end. Resolves with what it said, rejects with what
 * it complained. A `gentle` program runs at a lower priority than anything
 * else on the machine.
 */
export function run(
  command: string,
  args: string[],
  { gentle = false } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args)
    let output = ''
    let complaint = ''
    child.stdout.on('data', (data) => (output += data))
    child.stderr.on('data', (data) => (complaint += data))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(output)
      else
        reject(new Error(complaint.trim() || `${command} exited with ${code}`))
    })
    if (child.pid !== undefined && gentle) {
      try {
        // the song is a guest on its machine: anything else that needs it comes first
        setPriority(child.pid, gentleness)
      } catch {
        // some machines do not let a guest choose its place; it sings anyway
      }
    }
  })
}

/**
 * Takes turns. At most `limit` tasks are at work at once; the rest wait in
 * the order they came.
 */
export class Turns {
  private working = 0
  private waiting: (() => void)[] = []

  constructor(readonly limit: number) {}

  async take<T>(work: () => Promise<T>): Promise<T> {
    if (this.working < this.limit) this.working++
    // all turns are taken; wait until one is handed over
    else await new Promise<void>((resolve) => this.waiting.push(resolve))
    try {
      return await work()
    } finally {
      // the turn passes straight to whoever waited longest, or is given back
      const next = this.waiting.shift()
      if (next) next()
      else this.working--
    }
  }
}

/**
 * How many throats may sing at once: THROATS if given, otherwise half the
 * machine. The song sings an iteration ahead of the one it is singing, so
 * it can afford to wait its turn; the machine may have other work.
 */
export function throats(env = process.env.THROATS): number {
  const asked = Number(env)
  if (Number.isInteger(asked) && asked > 0) return asked
  return Math.max(1, Math.floor(availableParallelism() / 2))
}

const breaths = new Turns(throats())

/**
 * Runs the song's own work, the rendering and the mixing: one turn at a
 * time among the throats, and at a lower priority than anything else on
 * the machine.
 */
export function sing(command: string, args: string[]): Promise<string> {
  return breaths.take(() => run(command, args, { gentle: true }))
}
