import { describe, it, expect } from 'bun:test'
import { throats, Turns } from './exec.js'
import { panning } from './play.js'

describe('Turns', () => {
  it('lets only so many work at once, and the rest in the order they came', async () => {
    const turns = new Turns(2)
    let working = 0
    let most = 0
    const order: number[] = []
    const task = (n: number) =>
      turns.take(async () => {
        working++
        most = Math.max(most, working)
        await new Promise((resolve) => setTimeout(resolve, 5))
        order.push(n)
        working--
        return n
      })
    const results = await Promise.all([1, 2, 3, 4, 5].map(task))
    expect(results).toEqual([1, 2, 3, 4, 5])
    expect(most).toBe(2)
    expect(order.slice(0, 2).sort()).toEqual([1, 2])
  })

  it('never lets a newcomer slip in while a turn is being handed over', async () => {
    const turns = new Turns(1)
    let working = 0
    let most = 0
    const task = () =>
      turns.take(async () => {
        working++
        most = Math.max(most, working)
        await Promise.resolve()
        working--
      })
    const first = Promise.all([task(), task()])
    // a newcomer arriving just as the first turn ends
    await Promise.resolve()
    await Promise.all([first, task(), task()])
    expect(most).toBe(1)
  })

  it('gives the turn back when the work fails', async () => {
    const turns = new Turns(1)
    await expect(
      turns.take(() => Promise.reject(new Error('sore'))),
    ).rejects.toThrow('sore')
    expect(await turns.take(async () => 'sung')).toBe('sung')
  })
})

describe('throats', () => {
  it('takes as many as it is told', () => {
    expect(throats('3')).toBe(3)
  })

  it('takes half the machine otherwise, and never none', () => {
    expect(throats(undefined)).toBeGreaterThanOrEqual(1)
    expect(throats('0')).toBeGreaterThanOrEqual(1)
    expect(throats('many')).toBeGreaterThanOrEqual(1)
  })
})

describe('panning', () => {
  it('places a voice between the speakers at equal power', () => {
    expect(panning(0)).toBe('pan=stereo|c0=0.707*c0|c1=0.707*c0')
    expect(panning(-1)).toBe('pan=stereo|c0=1.000*c0|c1=0.000*c0')
    expect(panning(1)).toBe('pan=stereo|c0=0.000*c0|c1=1.000*c0')
  })
})
