import { describe, it, expect, beforeEach } from 'bun:test'
import { Heart } from './heart.js'

describe('Heart', () => {
  let time = 0
  const clock = () => time
  const minutes = (m: number) => (time += m * 60_000)
  beforeEach(() => {
    time = 1_000_000
  })

  it('is alive while waking, but not for ever', () => {
    const heart = new Heart(clock)
    expect(heart.pulse().alive).toBe(true)
    minutes(20)
    expect(heart.pulse()).toMatchObject({
      alive: false,
      because: 'it woke long ago and has not begun to sing',
    })
  })

  it('is alive while the iteration is being sung', () => {
    const heart = new Heart(clock)
    heart.beat({ iteration: 7n, seconds: 170, mood: 'dub + rust' })
    minutes(2)
    expect(heart.pulse(3)).toMatchObject({
      alive: true,
      because: 'singing',
      iteration: '7',
      mood: 'dub + rust',
      beganAgo: 120,
      lasts: 170,
      listeners: 3,
    })
  })

  it('is still alive through a long fermata', () => {
    const heart = new Heart(clock)
    heart.beat({ iteration: 7n, seconds: 170, mood: 'dub' })
    heart.fermata()
    minutes(12)
    expect(heart.pulse()).toMatchObject({
      alive: true,
      because: 'holding its breath: the next iteration is late',
      fermatas: 1,
    })
  })

  it('has missed too many beats when nothing follows an iteration for long', () => {
    const heart = new Heart(clock)
    heart.beat({ iteration: 7n, seconds: 170, mood: 'dub' })
    heart.stumble()
    minutes(30)
    expect(heart.pulse()).toMatchObject({ alive: false, stumbles: 1 })
  })

  it('takes heart again when the next iteration begins', () => {
    const heart = new Heart(clock)
    heart.beat({ iteration: 7n, seconds: 170, mood: 'dub' })
    minutes(30)
    heart.beat({ iteration: 8n, seconds: 170, mood: 'dub' })
    expect(heart.pulse().alive).toBe(true)
  })
})
