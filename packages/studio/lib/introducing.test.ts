import { describe, expect, it } from 'bun:test'
import type { Session } from 'archive'
import { rezzy } from 'dj'
import { introduce, unintroduced, type Introducing } from './introducing.js'
import { openingOf } from './intro.js'

const keys = (...names: string[]) => names.map((n) => `sessions/${n}.json`)

describe('unintroduced', () => {
  it('lists the Songs that have aired and have no intro, newest first, whatever the index says', () => {
    const held = keys('1', '2', '3', '10', '11', 'intro-2', 'intro-10', 'dj-rezzy-3', 'dj-rezzy-10')
    // 11 has not aired; 2 and 10 have intros kept apart; 3 has only a DJ's words
    expect(unintroduced(held, '10')).toEqual(['3', '1'])
    expect(unintroduced(held, '11')).toEqual(['11', '3', '1'])
  })

  it('orders numbers as numbers and takes nothing past what is playing', () => {
    expect(unintroduced(keys('9', '10', '100', '1000'), '100')).toEqual(['100', '10', '9'])
  })
})

/** A Session as far as an intro reads one: a lead who sings a first verse. */
const session = (song: string, extra: Partial<Session> = {}) =>
  ({
    song,
    name: `Song ${song}'s name`,
    mood: ['rain', 'gears'],
    mode: 'dorian',
    tempo: 80,
    sound: 'low strings',
    thought: 'I wondered.',
    singers: [{ body: 'female', harmony: 0 }],
    iterations: [{ parts: [{ type: 'verse', at: 0, lines: [{ at: 1, text: 'a line' }] }] }],
    recordings: [
      { id: 'h', kind: 'voice', voice: 0, at: 0.5, take: { bpm: 80, lyrics: 'ooh ooh', notes: [[60, 2], [62, 2]] } },
      { id: 'v', kind: 'voice', voice: 0, at: 1, take: { bpm: 80, lyrics: 'a line of words', notes: [[64.03, 1], [0, 1], [66.98, 2], [69, 2]], pressure: 8, tension: 0.5, breathiness: 0.2 } },
    ],
    ...extra,
  }) as unknown as Session

describe('openingOf', () => {
  it('leads into the first line of the first verse as the lead sang it, in degrees, and takes the lead\'s throat', () => {
    const opened = openingOf(session('7'))!
    expect(opened.phrase.notes).toHaveLength(3)
    expect(opened.phrase.notes.map(([, beats]) => beats)).toEqual([1, 2, 2])
    expect(opened.throat).toEqual({ pressure: 8, tension: 0.5, breathiness: 0.2 })
    expect(opened.body).toBe('female')
    expect(opened.mood.character).toMatchObject({ mode: 'dorian', tempo: 80, sound: 'low strings' })
  })

  it('has nothing to lead into when the Session holds no take of the lead', () => {
    expect(openingOf(session('7', { recordings: [] }))).toBeUndefined()
  })
})

const machine = (sessions: Record<string, Session>, options: { speech?: boolean; bedFails?: string[]; yieldsAfter?: number } = {}) => {
  const events: string[] = []
  const put = { recordings: [] as string[], djs: [] as string[], intros: [] as string[] }
  let asked = 0
  const run: Introducing = {
    store: {
      session: async (song) => sessions[song],
      putRecording: async (file) => (put.recordings.push(file), `id-${file}`),
      putDj: async (d) => void put.djs.push(`${d.dj}-${d.song}`),
      putIntro: async (r) => void put.intros.push(r.song),
    },
    dj: rezzy,
    mind: { wake: async () => (events.push('mind wakes'), true), rest: async () => void events.push('mind rests') },
    band: { wake: async () => void events.push('band wakes'), rest: async () => void events.push('band rests') },
    speak: async (facts) => (options.speech === false ? undefined : { text: `About ${facts.name}.`, syllables: 30 }),
    grow: async (opened) => {
      const song = opened.mood.descriptions.join('') + opened.tempo
      if (options.bedFails?.includes(song)) throw new Error('out of room')
      return { file: `bed-${++asked}.m4a`, at: -15, gain: 0.45, seconds: 15, fade: 3 }
    },
    loudness: async () => ({ lufs: -20, peak: -3 }),
    yields: async () => (options.yieldsAfter !== undefined && asked >= options.yieldsAfter) || false,
    log: (line) => void events.push(line),
  }
  return { run, put, events }
}

describe('introduce', () => {
  const all = { '3': session('3'), '2': session('2'), '1': session('1') }

  it('writes the words with the mind awake, grows the music with the band awake, and only then puts the intros in', async () => {
    const { run, put, events } = machine(all)
    const done = await introduce(run, ['3', '2', '1'], 2)
    expect(done.made).toEqual(['3', '2'])
    expect(put.intros).toEqual(['3', '2'])
    expect(put.djs).toEqual(['rezzy-3', 'rezzy-2'])
    expect(events.filter((e) => /wakes|rests/.test(e))).toEqual(['mind wakes', 'mind rests', 'band wakes', 'band rests'])
  })

  it('gives a Song its music even when the mind has nothing sensible to say, and its DJ does not come out', async () => {
    const { run, put } = machine(all, { speech: false })
    expect((await introduce(run, ['3'])).made).toEqual(['3'])
    expect(put.intros).toEqual(['3'])
    expect(put.djs).toEqual([])
  })

  it('leaves a Song whose music did not grow without an intro, to be tried again, and goes on', async () => {
    const { run, put } = machine(all, { bedFails: ['raingears80'] })
    const done = await introduce(run, ['3', '2'])
    expect(done.failed).toEqual(['3', '2'])
    expect(put.intros).toEqual([])
  })

  it('passes over Songs with an intro inside their Session, or none to lead into, without counting them', async () => {
    const sessions = { '3': session('3', { intro: {} as never }), '2': session('2', { recordings: [] }), '1': session('1') }
    const { run, put } = machine(sessions)
    const done = await introduce(run, ['3', '2', '1'], 1)
    expect(done.made).toEqual(['1'])
    expect(put.intros).toEqual(['1'])
  })

  it('stops as soon as a Studio is wanted, and rests what it woke', async () => {
    const { run, events } = machine(all, { yieldsAfter: 0 })
    const done = await introduce(run, ['3', '2'])
    expect(done.yielded).toBe(true)
    expect(done.made).toEqual([])
    expect(events).toContain('mind rests')
    expect(events).not.toContain('band wakes')
  })
})
