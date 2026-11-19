import { describe, expect, it } from 'bun:test'
import { endOf, grace, lead, Tactus } from './tactus.js'

describe('Tactus', () => {
  it('begins the first Song when Receivers have had time to fetch it', () => {
    let now = 1_000_000
    const tactus = new Tactus([], () => now)
    expect(tactus.candidate(['3', '4'])).toBe('3')
    const first = tactus.announce('3', 600)!
    expect(first.begins).toBe(now + lead)
    expect(tactus.next).toEqual(first)
    now = first.begins
    expect(tactus.playing).toEqual(first)
  })

  it('begins the next Song exactly when the last ends, if it is ready in time', () => {
    let now = 0
    const tactus = new Tactus([{ song: '3', begins: 0, seconds: 600 }], () => now)
    now = 60_000
    expect(tactus.candidate(['2', '3', '4', '5'])).toBe('4')
    const next = tactus.announce('4', 500)!
    expect(next.begins).toBe(600_000)
    // only one Song waits at a time, and its beginning never moves
    expect(tactus.announce('5', 500)).toBeUndefined()
    now = 600_000
    expect(tactus.playing?.song).toBe('4')
  })

  it('holds its breath when the next Song arrives late', () => {
    let now = 0
    const tactus = new Tactus([{ song: '3', begins: 0, seconds: 600 }], () => now)
    now = 610_000
    expect(tactus.playing).toBeUndefined()
    expect(tactus.pulse().alive).toBe(true)
    const late = tactus.announce('4', 500)!
    expect(late.begins).toBe(610_000 + lead)
  })

  it('skips a Song the Studio never finished', () => {
    const tactus = new Tactus([{ song: '3', begins: 0, seconds: 600 }], () => 0)
    expect(tactus.candidate(['3', '5'])).toBe('5')
    expect(tactus.candidate(['2', '3'])).toBeUndefined()
  })

  it('says when its heart has stopped', () => {
    let now = 0
    const aired = { song: '3', begins: 0, seconds: 600 }
    const tactus = new Tactus([aired], () => now)
    now = endOf(aired) + grace + 1
    expect(tactus.pulse()).toEqual({
      alive: false,
      because: 'silent for too long, and nothing announced',
    })
  })
})

describe('what follows a Song heard again', () => {
  const minute = 60_000
  const aired = [
    { song: '10', begins: 0, seconds: 60 },
    { song: '12', begins: minute, seconds: 60 },
    { song: '12', begins: 2 * minute, seconds: 60 },
    { song: '15', begins: 3 * minute, seconds: 60 },
    { song: '16', begins: 4 * minute, seconds: 60 },
  ]

  it('is the next Song that aired to its end, in the order they aired, a Song aired twice counted once', () => {
    const tactus = new Tactus([...aired], () => 4.5 * minute)
    expect(tactus.after('10')).toEqual({ song: '12' })
    expect(tactus.after('12')).toEqual({ song: '15' })
  })

  it('is live when what follows is playing now, or is still to come, or nothing aired after it', () => {
    expect(new Tactus([...aired], () => 4.5 * minute).after('15')).toEqual({ live: true })
    expect(new Tactus([...aired], () => 3.5 * minute).after('12')).toEqual({ live: true })
    expect(new Tactus([...aired], () => 10 * minute).after('16')).toEqual({ live: true })
  })

  it('follows a Song the Radio never aired with the next one after it by number', () => {
    expect(new Tactus([...aired], () => 10 * minute).after('11')).toEqual({ song: '12' })
    expect(new Tactus([...aired], () => 10 * minute).after('13')).toEqual({ song: '15' })
  })

  describe('encores', () => {
    const encore = { setup: 'favourites' }

    it('fills the quiet with a Song already aired, marked as an encore, and keeps it out of the Songs received', () => {
      let now = 0
      const tactus = new Tactus([{ song: '3', begins: 0, seconds: 600 }], () => now)
      now = 700_000
      expect(tactus.hungry).toBe(true)
      const again = tactus.announce('1', 300, encore)!
      expect(again).toMatchObject({ song: '1', mode: 'encore', setup: 'favourites', begins: now + lead })
      expect(tactus.hungry).toBe(false)
      now = again.begins
      expect(tactus.playing).toEqual(again)
      expect(tactus.mode).toBe('encore')
      expect(tactus.history.map((a) => a.song)).toEqual(['3'])
      expect(tactus.encores).toEqual([again])
      // the live show is not moved by it
      expect(tactus.candidates(['1', '3', '4'])).toEqual(['4'])
      expect(tactus.after('3')).toEqual({ live: true })
    })

    it('is hungry only near the end of one being aired, so a new Song is not queued behind a second', () => {
      let now = 0
      const tactus = new Tactus([{ song: '3', begins: 0, seconds: 600, mode: 'encore', setup: 'favourites' }], () => now)
      now = 100_000
      expect(tactus.hungry).toBe(false)
      now = 600_000 - 2 * lead
      expect(tactus.hungry).toBe(true)
    })

    it('begins the live show only after the encore has ended, and is live again then', () => {
      let now = 0
      const tactus = new Tactus([{ song: '1', begins: 0, seconds: 300, mode: 'encore', setup: 'favourites' }], () => now)
      now = 100_000
      const live = tactus.announce('4', 500)!
      expect(live.begins).toBe(300_000)
      expect(live.mode).toBeUndefined()
      now = 250_000
      expect(tactus.mode).toBe('encore')
      now = 300_000
      expect(tactus.mode).toBe('live')
      expect(tactus.history.map((a) => a.song)).toEqual(['4'])
    })

    it('keeps the song alive while an encore sings, and lets it die when nothing sings at all', () => {
      let now = 0
      const tactus = new Tactus([{ song: '1', begins: 0, seconds: 300, mode: 'encore', setup: 'favourites' }], () => now)
      now = 100_000
      expect(tactus.pulse().alive).toBe(true)
      now = 300_000 + grace
      expect(tactus.pulse().alive).toBe(false)
    })
  })
})
