import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeWav, speakInto } from './speak.js'
import { renderDrone, renderDrums, renderPulse, renderSynth, synthRate } from './synth.js'

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

  it('evolves drone brightness across the block when build differs from warmth', () => {
    const bloom = renderDrone({
      kind: 'drone',
      mode: 'dorian',
      tonic: 45,
      seconds: 4,
      warmth: 0.1,
      build: 0.95,
      movement: 0.3,
      octave: -1,
      seed: 'bloom-1',
    })
    const steady = renderDrone({
      kind: 'drone',
      mode: 'dorian',
      tonic: 45,
      seconds: 4,
      warmth: 0.1,
      movement: 0.3,
      octave: -1,
      seed: 'bloom-1',
    })
    // high-frequency delta (rough spectral brightness proxy) in the final quarter is significantly higher when blooming
    const hf = (buf: Float32Array, from: number, to: number) => {
      let sum = 0
      for (let i = from + 1; i < to; i++) sum += Math.abs(buf[i]! - buf[i - 1]!)
      return sum / (to - from)
    }
    const q = Math.floor(bloom.length / 4)
    expect(hf(bloom, 3 * q, bloom.length - 1000)).toBeGreaterThan(hf(steady, 3 * q, steady.length - 1000) * 1.25)
  })

  it('renders deterministic evolving drums across tribal, trance, and ritual styles, and stays silent in free time', () => {
    const rms = (buf: Float32Array, from: number, to: number) => {
      let sum = 0
      for (let i = from; i < to; i++) sum += buf[i]! * buf[i]!
      return Math.sqrt(sum / (to - from))
    }
    for (const style of ['tribal', 'trance', 'ritual'] as const) {
      const spec = {
        kind: 'drums' as const,
        style,
        mode: 'aeolian',
        tonic: 45,
        bpm: 76,
        seconds: 8,
        intensity: 0.12,
        build: 0.96,
        swing: 0.1,
        halfTime: style === 'ritual' ? 1 : 0,
        seed: `drums-${style}`,
      }
      const a = renderDrums(spec)
      const b = renderSynth(spec)
      expect(a.length).toBe(Math.round(8 * synthRate))
      expect(a).toEqual(b)
      let peak = 0
      for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i]!))
      expect(peak).toBeGreaterThan(0.15)
      expect(peak).toBeLessThanOrEqual(0.82)
      // genuine crescendo: last quarter RMS clearly exceeds opening quarter RMS
      const q = Math.floor(a.length / 4)
      expect(rms(a, 3 * q, a.length)).toBeGreaterThan(rms(a, 0, q) * 1.3)
    }
    // free time (bpm <= 0) must be strictly silent
    const silent = renderDrums({ kind: 'drums', style: 'tribal', mode: 'dorian', tonic: 45, bpm: 0, seconds: 1, seed: 'silent-1' })
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
