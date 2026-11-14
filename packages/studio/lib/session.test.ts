import { describe, expect, it } from 'bun:test'
import { firstMood } from 'mood'
import { arrange, firstLyrics } from 'song'
import { firstChoir } from 'vocals'
import { firstTune } from 'melody'
import { defaults } from 'perspectives'
import type { Iteration } from './compose.js'
import type { SungLine } from './perform.js'
import { toSession, type Made } from './session.js'

/** A take as the throat is given it, with the throat it is sung through. */
const takeOf = (lyrics: string, voice: number) => ({
  bpm: 76,
  lyrics,
  notes: [[57 + voice / 100, 2], [59, 2], [0, 1]] as [number, number][],
  t0: 0.3,
  vibrato: 30,
  pressure: 9,
  tension: 0.55,
  breathiness: 0.15,
})

/** An iteration as the Studio would make it, every line six seconds, its file named after it. */
function made(iteration: bigint, began = 0n): Made {
  const composed: Iteration = {
    iteration,
    mood: firstMood,
    choir: firstChoir,
    tune: firstTune,
    variation: 0,
    sung: firstTune,
    beginsSong: iteration === began,
    song: { number: '0', began: `${began}`, lasts: 4 },
    lyrics: firstLyrics,
    perspectives: [{ slug: 'bridge-beds-atonal', title: 'Atonal bridges', facet: 'bridge-beds', variant: 'free jazz' }],
    settings: defaults(3),
    rate: 6,
  }
  const lines: SungLine[] = []
  let at = 0
  for (const part of arrange(firstLyrics)) {
    const texts = part.type === 'bridge' ? [''] : part.content.split('\n').filter((t) => t.trim())
    texts.forEach((text, index) => {
      lines.push({
        part: part.type,
        index: part.type === 'bridge' ? part.index : index,
        lyrics: text,
        file: `${iteration}-${part.index}-${index}.m4a`,
        voices: (part.type === 'chorus' ? [0, 1, 2] : [0]).map((voice) => ({
          file: `${iteration}-${part.index}-${index}-${voice}.m4a`,
          voice,
          gain: [1, 0.55, 0.45][voice],
          take: takeOf(text || 'ooh', voice),
        })),
        recordings: [],
        seconds: 6,
        enters: 0.3,
        voiced: 5,
        at,
        ...(part.type === 'bridge' && part.index === 1 ? { unheard: true } : {}),
      })
      at += 6
    })
  }
  return {
    composed,
    lines,
    beds: [{ file: `bed-${iteration}.m4a`, at: 0, gain: 0.45, seconds: 36, fade: 3 }],
    guides: [
      {
        kind: 'verse',
        part: 'verse',
        at: 0,
        seconds: 36,
        file: `guide-${iteration}.m4a`,
        score: { bpm: 76, notes: [[57, 4], [59, 4]] },
        take: { bpm: 76, lyrics: 'ooh ooh', notes: [[57, 4], [59, 4]], t0: 0.05, vibrato: 0 },
      },
      {
        kind: 'bridge:verse>chorus',
        part: 'bridge',
        at: 36,
        seconds: 12,
        file: `bridge-guide-${iteration}.m4a`,
        score: { bpm: 76, notes: [[57, 8], [60, 8]] },
        take: { bpm: 76, lyrics: 'ooh ooh', notes: [[57, 8], [60, 8]], t0: 0.05, vibrato: 0 },
      },
    ],
  }
}

describe('toSession', () => {
  const session = toSession(
    [made(0n), made(1n)],
    (file) => `id:${file}`,
    (file) => (file.startsWith('bed-') ? { lufs: -14.2, peak: -1.1 } : { lufs: -19.5, peak: -6 }),
    'c24945a+0123456789ab',
  )

  it('says how many syllables a second its voices could sing', () => {
    expect(session.rate).toBe(6)
  })

  it('keeps every voice as its take, for a Receiver to sing, and the Music as sound', () => {
    expect(session.throat).toBe('c24945a+0123456789ab')
    const voices = session.recordings.filter(({ kind }) => kind === 'voice')
    expect(voices.length).toBeGreaterThan(0)
    expect(voices.every(({ take }) => take !== undefined)).toBe(true)
    const chorusHarmony = session.recordings.find(({ id }) => id === 'id:0-2-0-1.m4a')
    expect(chorusHarmony?.take).toEqual(takeOf(session.iterations[0].parts.find(({ type }) => type === 'chorus')!.lines[0].text, 1))
    expect(session.recordings.filter(({ kind }) => kind === 'bed').every(({ take }) => take === undefined)).toBe(true)
    // a guide keeps its whole take, words and breath and all
    expect(session.guides?.[0].take).toEqual({ bpm: 76, lyrics: 'ooh ooh', notes: [[57, 4], [59, 4]], t0: 0.05, vibrato: 0 })
  })

  it('says which Perspectives its Song is heard from', () => {
    expect(session.perspectives).toEqual([
      { slug: 'bridge-beds-atonal', title: 'Atonal bridges', facet: 'bridge-beds', variant: 'free jazz' },
    ])
  })

  it('lays the iterations end to end', () => {
    const [first, second] = session.iterations
    expect(first.at).toBe(0)
    expect(second.at).toBe(first.seconds)
    expect(session.seconds).toBe(first.seconds + second.seconds)
    expect(second.of).toEqual({ at: 2, of: 4 })
  })

  it('gives each chorus its own moment, though they sing the same words', () => {
    const choruses = session.iterations[0].parts.filter(({ type }) => type === 'chorus')
    expect(choruses).toHaveLength(2)
    expect(choruses[0].lines[0].text).toBe(choruses[1].lines[0].text)
    expect(choruses[1].lines[0].at).toBeGreaterThan(choruses[0].lines[0].at)
  })

  it('types every line while it is sung, and ends it when the voice ends', () => {
    const line = session.iterations[1].parts[0].lines[0]
    expect(line.typing).toHaveLength(line.text.length + 1)
    expect(line.typing.at(-1)).toBe(5300)
    expect(line.at).toBe(session.iterations[1].at)
  })

  it('places every Recording that is heard, and none that is not', () => {
    const ids = session.recordings.map(({ id }) => id)
    expect(ids).not.toContain('id:0-1-0-0.m4a')
    expect(ids).toContain('id:0-3-0-0.m4a')
    const bed = session.recordings.find(({ id }) => id === 'id:bed-1.m4a')
    expect(bed).toMatchObject({ kind: 'bed', gain: 0.45, at: session.iterations[1].at })
  })

  it('gives every singer of the chorus a recording of their own', () => {
    expect(session.singers.map(({ body }) => body)).toEqual(['female', 'child', 'male'])
    const chorusLine = session.recordings.filter(({ id }) => id.startsWith('id:0-2-0-'))
    expect(chorusLine.map(({ voice, gain }) => [voice, gain])).toEqual([
      [0, undefined],
      [1, 0.55],
      [2, 0.45],
    ])
    // the blend the Music listens to is not what Receivers are given
    expect(session.recordings.map(({ id }) => id)).not.toContain('id:0-2-0.m4a')
  })

  it('says how loud every Recording sounds', () => {
    expect(session.recordings.every(({ loudness }) => loudness !== undefined)).toBe(true)
    const bed = session.recordings.find(({ kind }) => kind === 'bed')
    expect(bed?.loudness).toEqual({ lufs: -14.2, peak: -1.1 })
  })

  it('keeps the guides apart, never among what is played', () => {
    expect(session.guides?.map(({ id, kind, at }) => [id, kind, at])).toEqual([
      ['id:guide-0.m4a', 'guide', 0],
      ['id:bridge-guide-0.m4a', 'guide', 36],
      ['id:guide-1.m4a', 'guide', session.iterations[1].at],
      ['id:bridge-guide-1.m4a', 'guide', session.iterations[1].at + 36],
    ])
    const bridge = session.guides?.[1]
    expect(bridge).toMatchObject({ part: 'bridge', from: 'verse', to: 'chorus' })
    expect(bridge?.score.notes).toEqual([[57, 8], [60, 8]])
    const bed = session.recordings.find(({ kind }) => kind === 'bed')
    expect(bed).toMatchObject({ seconds: 36, fade: 3 })
    expect(session.recordings.some(({ id }) => id.includes('guide'))).toBe(false)
  })

  it('has no words in its bridges', () => {
    const bridges = session.iterations[0].parts.filter(({ type }) => type === 'bridge')
    expect(bridges).toHaveLength(4)
    expect(bridges.every(({ lines }) => lines.length === 0)).toBe(true)
  })
})
