import { describe, expect, test } from 'bun:test'
import { holdStudio, StudioBusy } from './lock.js'

// each test has a lock of its own, so tests never meet the live Studio's
const lockFor = (what: string) => `\0ikuradio-studio-test-${process.pid}-${what}`

/** Asks a separate process to hold the lock, and says how it went. */
async function holdElsewhere(name: string, then: 'release' | 'die'): Promise<string> {
  const code = `
    import { holdStudio } from ${JSON.stringify(new URL('./lock.ts', import.meta.url).pathname)}
    try {
      const held = holdStudio(${JSON.stringify(name)})
      console.log('held')
      if (${JSON.stringify(then)} === 'die') process.kill(process.pid, 'SIGKILL')
      held.release()
    } catch (error) {
      console.log(error.name)
    }
  `
  const child = Bun.spawn(['bun', '-e', code], { stdout: 'pipe', stderr: 'pipe' })
  await child.exited
  return (await new Response(child.stdout).text()).trim()
}

describe('the Studio lock', () => {
  test('one holder at a time; a second is refused', () => {
    const name = lockFor('twice')
    const held = holdStudio(name)
    expect(() => holdStudio(name)).toThrow(StudioBusy)
    held.release()
  })

  test('let go, it can be held again', () => {
    const name = lockFor('again')
    holdStudio(name).release()
    const held = holdStudio(name)
    held.release()
  })

  test('another process is refused while it is held here', async () => {
    const name = lockFor('across')
    const held = holdStudio(name)
    expect(await holdElsewhere(name, 'release')).toBe('StudioBusy')
    held.release()
    expect(await holdElsewhere(name, 'release')).toBe('held')
  })

  test('a holder that is killed leaves no lock behind', async () => {
    const name = lockFor('killed')
    expect(await holdElsewhere(name, 'die')).toBe('held')
    const held = holdStudio(name)
    held.release()
  })
})
