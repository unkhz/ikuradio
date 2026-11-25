import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { firstMood } from 'mood'
import { runQueueCli } from '../queue.js'
import {
  applyQueuedMood,
  describeQueued,
  refuseQueuedSpec,
  SongQueue,
  validateQueuedSong,
  type QueuedSongSpec,
} from './queue.js'

const tempQueue = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ikuradio-queue-'))
  return { dir, queue: new SongQueue(join(dir, 'queue.jsonl')) }
}

describe('manual production SongQueue', () => {
  it('validates ranges and rejects unknown fields or out-of-range values', async () => {
    expect(refuseQueuedSpec({})).toBeUndefined()
    expect(
      refuseQueuedSpec({
        arrangement: 'the-ascent',
        perspectives: [],
        mood: ['obsidian desert', 'distant drums'],
        mode: 'phrygian',
        tempo: 68,
        sound: 'slow cello and analog pads',
        choir: 3,
        lead: 'female',
        breath: 'soft',
        rate: 5.5,
        note: 'test ascent',
      }),
    ).toBeUndefined()

    expect(refuseQueuedSpec({ unknownField: 1 })).toContain('unknown queued Song property')
    expect(refuseQueuedSpec({ id: 'injected', attempts: 9 })).toContain('unknown queued Song property')
    expect(refuseQueuedSpec({ mode: 'bebop' })).toContain('mode must be one of')
    expect(refuseQueuedSpec({ tempo: 10 })).toContain('between 20 and 300')
    expect(refuseQueuedSpec({ choir: 5 })).toContain('between 1 and 4')
    expect(refuseQueuedSpec({ lead: 'baritone' })).toContain('lead must be one of')
    expect(refuseQueuedSpec({ breath: 'shouted' })).toContain('breath must be one of')
    expect(refuseQueuedSpec({ rate: 25 })).toContain('between 2 and 12')
    expect(refuseQueuedSpec({ mood: [] })).toContain('1 to 5')

    // async registry checks against real active arrangements & perspectives (including duplicates and facet clashes)
    expect(await validateQueuedSong({ arrangement: 'the-ascent', perspectives: [] })).toBeUndefined()
    expect(await validateQueuedSong({ arrangement: 'tempo-turns' })).toBeUndefined()
    expect(await validateQueuedSong({ arrangement: 'nonexistent-arrangement' })).toContain('cannot be read')
    expect(await validateQueuedSong({ perspectives: ['no-such-perspective'] })).toContain('unknown perspective')
    expect(await validateQueuedSong({ perspectives: ['choir-full', 'choir-full'] })).toContain('duplicate perspective')
    expect(await validateQueuedSong({ perspectives: ['choir-full', 'choir-in-the-verses'] })).toContain('clash')
  })

  it('persists FIFO entries, supports peek/markAttempt/consume/pop/clear, and ignores torn lines', async () => {
    const { dir, queue } = tempQueue()
    try {
      expect(await queue.list()).toEqual([])
      expect(await queue.peek()).toBeUndefined()

      const a = await queue.push({ arrangement: 'the-ascent', tempo: 70.4, note: 'first' })
      const b = await queue.push({ arrangement: 'the-long-breath', mode: 'dorian' })
      expect(a.tempo).toBe(70)
      expect((await queue.list()).map((e) => e.id)).toEqual([a.id, b.id])
      expect((await queue.peek())!.id).toBe(a.id)

      // markAttempt persists across re-reads without removing head
      expect(await queue.markAttempt(a.id)).toBe(1)
      expect(await queue.markAttempt(a.id)).toBe(2)
      expect((await queue.peek())!.attempts).toBe(2)

      // consume removes only the exact id
      expect(await queue.consume(a.id)).toBe(true)
      expect(await queue.consume(a.id)).toBe(false)
      expect((await queue.list()).map((e) => e.id)).toEqual([b.id])

      // pop & clear
      const popped = await queue.pop()
      expect(popped!.id).toBe(b.id)
      expect(await queue.list()).toEqual([])

      await queue.push({ arrangement: 'the-song' })
      await queue.push({ arrangement: 'the-ascent' })
      expect(await queue.clear()).toBe(2)
      expect(await queue.list()).toEqual([])

      // torn lines are ignored safely
      writeFileSync(queue.file, `{broken json\n${JSON.stringify(a)}\n`)
      expect((await queue.list()).map((e) => e.id)).toEqual([a.id])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('drops invalid or exhausted entries in nextReady so a bad request never stalls the radio', async () => {
    const { dir, queue } = tempQueue()
    try {
      const bad = await queue.push({ arrangement: 'missing-arrangement' })
      const exhausted = await queue.push({ arrangement: 'the-ascent', note: 'flaky' })
      await queue.markAttempt(exhausted.id)
      await queue.markAttempt(exhausted.id)
      await queue.markAttempt(exhausted.id)
      const good = await queue.push({ arrangement: 'the-ascent', tempo: 68, note: 'good' })

      const warnings: string[] = []
      const ready = await queue.nextReady({ warn: (m) => warnings.push(m) })
      expect(ready?.id).toBe(good.id)
      expect(warnings).toHaveLength(2)
      expect(warnings[0]).toContain(bad.id)
      expect(warnings[1]).toContain(exhausted.id)
      expect((await queue.list()).map((e) => e.id)).toEqual([good.id])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('layers mood, mode, tempo, sound, lead, and breath overrides cleanly onto a Mood', () => {
    const spec: QueuedSongSpec = {
      mood: ['volcanic dusk', 'cathedral organ'],
      mode: 'phrygian',
      tempo: 66,
      sound: 'deep organ and slow tribal drums',
      lead: 'male',
      breath: 'pressed',
    }
    const next = applyQueuedMood(firstMood, spec)
    expect(next.descriptions).toEqual(['volcanic dusk', 'cathedral organ'])
    expect(next.character).toEqual({
      mode: 'phrygian',
      tempo: 66,
      sound: 'deep organ and slow tribal drums',
      voice: { lead: 'male', breath: 'pressed' },
    })
    expect(describeQueued({ id: 'abc12345', queued: '2026-11-25T00:00:00Z', ...spec })).toContain('mode=phrygian')
    expect(describeQueued({ id: 'abc12345', queued: '2026-11-25T00:00:00Z', ...spec })).toContain('tempo=66bpm')
  })

  it('drives the queue CLI cleanly (add, list, remove by prefix, pop, clear, and refuses invalid flags)', async () => {
    const { dir, queue } = tempQueue()
    try {
      expect(await runQueueCli(['--file', queue.file, 'list'])).toBe(0)
      expect(
        await runQueueCli([
          '--file',
          queue.file,
          'add',
          '--arrangement',
          'the-ascent',
          '--tempo',
          '68',
          '--mode',
          'phrygian',
          '--mood',
          'obsidian night, distant embers',
          '--perspectives',
          'none',
          '--choir',
          '3',
          '--lead',
          'female',
          '--breath',
          'soft',
          '--note',
          'prod test',
          '--count',
          '2',
        ]),
      ).toBe(0)
      const added = await queue.list()
      expect(added).toHaveLength(2)
      expect(added[0]).toMatchObject({
        arrangement: 'the-ascent',
        tempo: 68,
        mode: 'phrygian',
        mood: ['obsidian night', 'distant embers'],
        perspectives: [],
        choir: 3,
        lead: 'female',
        breath: 'soft',
        note: 'prod test',
      })
      // invalid arrangement or empty mood refused cleanly
      expect(await runQueueCli(['--file', queue.file, 'add', '--arrangement', 'does-not-exist'])).toBe(1)
      expect(await runQueueCli(['--file', queue.file, 'add', '--mood', ''])).toBe(1)
      // remove first by 4-char prefix
      expect(await runQueueCli(['--file', queue.file, 'remove', added[0]!.id.slice(0, 4)])).toBe(0)
      expect((await queue.list()).map((e) => e.id)).toEqual([added[1]!.id])
      // clear remaining
      expect(await runQueueCli(['--file', queue.file, 'clear'])).toBe(0)
      expect(await queue.list()).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
