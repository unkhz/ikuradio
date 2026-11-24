import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeWav, speakInto } from './speak.js'
import { renderDrone, renderPulse, renderSynth, synthRate } from './synth.js'

describe('procedural synth tracks (drone & pulse)', () => {
  it('renders deterministic harmonic drone audio with smooth chord glides and bounded peaks', () => {
    const spec = {
      kind: 'drone' as const,
      mode: 'dorian',
      tonic: 45,
      seconds: 1.5,
      warmth: 0.6,
      movement: 0.5,
      octave: 0,
      chords: [
        { at: 0, seconds: 0.75, root: 0, bass: 0 },
        { at: 0.75, seconds: 0.75, root: 3, bass: 3 },
      ],
      seed: 'song-1',
    }
    const a = renderDrone(spec)
    const b = renderSynth(spec)
    expect(a.length).toBe(Math.round(1.5 * synthRate))
    expect(a).toEqual(b)
    let peak = 0
    for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i]!))
    expect(peak).toBeGreaterThan(0.05)
    expect(peak).toBeLessThanOrEqual(0.8)
    // edge fade prevents click at t=0
    expect(Math.abs(a[0]!)).toBe(0)
  })

  it('renders deterministic pitched pulse locked to bpm and falls silent in free time', () => {
    const spec = {
      kind: 'pulse' as const,
      mode: 'aeolian',
      tonic: 57,
      bpm: 96,
      seconds: 2.0,
      density: 0.8,
      swing: 0.2,
      tone: 0.5,
      seed: 'song-2',
    }
    const a = renderPulse(spec)
    const b = renderSynth(spec)
    expect(a.length).toBe(Math.round(2.0 * synthRate))
    expect(a).toEqual(b)
    let peak = 0
    for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i]!))
    expect(peak).toBeGreaterThan(0.1)
    expect(peak).toBeLessThanOrEqual(0.8)

    // free time (bpm <= 0) must be strictly silent
    const silent = renderPulse({ ...spec, bpm: 0 })
    expect(silent.every((s) => s === 0)).toBe(true)
  })

  it('encodes valid 16-bit mono RIFF WAV headers', () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1]), 48000)
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE')
    expect(wav.length).toBe(44 + 5 * 2)
  })

  it('speaks text via Chimera speaking throat WASM with finite duration and segments', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ikuradio-speak-'))
    try {
      const said = await speakInto({ text: 'A quiet breath in the dark.', body: 'female', rate: 0.92 }, join(dir, 'line.wav'))
      expect(said.file.endsWith('.wav')).toBe(true)
      expect(said.seconds).toBeGreaterThan(0.5)
      expect(said.segments.length).toBeGreaterThan(3)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
