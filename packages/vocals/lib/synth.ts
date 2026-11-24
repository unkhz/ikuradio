// Deterministic procedural 48 kHz PCM synthesis for non-MusicGen Tracks
// (`drone` and `pulse`). Identical algorithm runs in the browser Receiver
// (`packages/ui/public/synth.js`), CLI Receiver, and Studio (for loudness
// measurement and rehearsal mixdown), keeping the Archive free of audio files.

import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { makeOnce, vocalsDir } from './chimera.js'
import { encodeWav } from './speak.js'

export type SynthSpec =
  | {
      kind: 'drone'
      mode: string
      tonic: number
      seconds: number
      fadeIn?: number
      fade?: number
      chords?: { at: number; seconds: number; root: number; bass?: number }[]
      warmth?: number
      build?: number
      movement?: number
      octave?: number
      seed: string
    }
  | {
      kind: 'pulse'
      mode: string
      tonic: number
      bpm: number
      seconds: number
      fadeIn?: number
      fade?: number
      density?: number
      swing?: number
      tone?: number
      seed: string
    }
  | {
      kind: 'drums'
      style: 'tribal' | 'trance' | 'ritual'
      mode: string
      tonic: number
      bpm: number
      seconds: number
      fadeIn?: number
      fade?: number
      intensity?: number
      build?: number
      swing?: number
      halfTime?: number
      seed: string
    }

export const synthRate = 48000

const modeSteps: Record<string, readonly number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
}

const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

function degreeToMidi(degree: number, mode: string, tonic: number): number {
  const scale = modeSteps[mode] ?? modeSteps.aeolian!
  const octaves = Math.floor(degree / 7)
  const step = ((degree % 7) + 7) % 7
  return tonic + octaves * 12 + scale[step]!
}

function prng(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let s = h >>> 0 || 0x9e3779b9
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

/**
 * Renders a warm, continuous harmonic drone bed that glides gently across the
 * Song's guide chords (or holds the tonic and fifth when no chords are given).
 */
export function renderDrone(spec: Extract<SynthSpec, { kind: 'drone' }>, sampleRate = synthRate): Float32Array {
  const total = Math.max(1, Math.round(spec.seconds * sampleRate))
  const out = new Float32Array(total)
  const warmthStart = Math.max(0, Math.min(1, spec.warmth ?? 0.55))
  const warmthEnd = Math.max(0, Math.min(1, spec.build ?? warmthStart))
  const movement = Math.max(0, Math.min(1, spec.movement ?? 0.4))
  const octaveShift = Math.max(-1, Math.min(1, Math.round(spec.octave ?? 0))) * 12
  const baseTonic = spec.tonic + octaveShift
  const chords = spec.chords ?? []
  const rand = prng(`drone:${spec.seed}`)

  // random initial phases so harmonics breathe without a harsh impulse at t=0
  let pRoot = rand() * Math.PI * 2
  let pSub = rand() * Math.PI * 2
  let pFifthA = rand() * Math.PI * 2
  let pFifthB = rand() * Math.PI * 2
  let pOct = rand() * Math.PI * 2
  let pThird = rand() * Math.PI * 2
  const lfoPhaseA = rand() * Math.PI * 2
  const lfoPhaseB = rand() * Math.PI * 2

  const tonicHz = midiToHz(baseTonic)
  const fifthHz0 = midiToHz(degreeToMidi(4, spec.mode, baseTonic))
  const thirdHz0 = midiToHz(degreeToMidi(2, spec.mode, baseTonic + 12))
  let curRoot = tonicHz
  let curFifth = fifthHz0
  let curThird = thirdHz0

  // smooth chord glide (~180ms time constant) and evolving one-pole warmth low-pass filter
  const glide = 1 - Math.exp(-1 / (0.18 * sampleRate))
  let lp = 0
  let chordIdx = 0

  const edgeRamp = Math.min(Math.round(0.03 * sampleRate), Math.floor(total / 2))
  const twoPi = Math.PI * 2
  const invSr = 1 / sampleRate
  const detune = 0.0025 + movement * 0.004
  const invTotal = 1 / Math.max(1, total - 1)

  for (let i = 0; i < total; i++) {
    const t = i * invSr
    const progress = i * invTotal
    const warmth = warmthStart + (warmthEnd - warmthStart) * progress
    const cutoff = 140 + warmth * warmth * 1800
    const lpAlpha = Math.min(0.95, (twoPi * cutoff) / (twoPi * cutoff + sampleRate))

    while (chordIdx < chords.length - 1 && t >= chords[chordIdx]!.at + chords[chordIdx]!.seconds) {
      chordIdx++
    }
    const active = chords[chordIdx]
    let targetRoot = tonicHz
    let targetFifth = fifthHz0
    let targetThird = thirdHz0
    if (active && t >= active.at && t <= active.at + active.seconds + 0.5) {
      const deg = active.bass ?? active.root
      targetRoot = midiToHz(degreeToMidi(deg, spec.mode, baseTonic))
      targetFifth = midiToHz(degreeToMidi(active.root + 4, spec.mode, baseTonic))
      targetThird = midiToHz(degreeToMidi(active.root + 2, spec.mode, baseTonic + 12))
    }
    curRoot += (targetRoot - curRoot) * glide
    curFifth += (targetFifth - curFifth) * glide
    curThird += (targetThird - curThird) * glide

    pRoot += twoPi * curRoot * invSr
    pSub += twoPi * (curRoot * 0.5) * invSr
    pFifthA += twoPi * (curFifth * (1 - detune)) * invSr
    pFifthB += twoPi * (curFifth * (1 + detune)) * invSr
    pOct += twoPi * (curRoot * 2) * invSr
    pThird += twoPi * curThird * invSr

    const breathA = 0.72 + 0.28 * movement * Math.sin(twoPi * 0.11 * t + lfoPhaseA)
    const breathB = 0.65 + 0.35 * movement * Math.sin(twoPi * 0.07 * t + lfoPhaseB)

    // gentle odd+even warmth: soft saturated fundamental + breathing fifth + blooming upper shimmer
    const bloom = warmth * warmth
    const raw =
      0.42 * Math.sin(pRoot) +
      0.16 * Math.sin(pSub) +
      0.16 * breathA * Math.sin(pFifthA) +
      0.16 * breathB * Math.sin(pFifthB) +
      (0.05 + 0.16 * warmth) * breathB * Math.sin(pOct) +
      (0.02 + 0.11 * warmth) * breathA * Math.sin(pThird) +
      0.14 * bloom * breathB * Math.sin(pOct * 2) +
      0.08 * bloom * breathA * Math.sin(pThird * 2)

    lp += lpAlpha * (raw - lp)
    let env = 1
    if (i < edgeRamp) env = i / edgeRamp
    else if (i >= total - edgeRamp) env = (total - 1 - i) / edgeRamp
    out[i] = Math.tanh(lp * 1.15) * 0.55 * env
  }
  return out
}

/**
 * Renders a minimalist, organic pitched pulse locked to `bpm`. Returns silence
 * if `bpm` is not a positive finite number (free time).
 */
export function renderPulse(spec: Extract<SynthSpec, { kind: 'pulse' }>, sampleRate = synthRate): Float32Array {
  const total = Math.max(1, Math.round(spec.seconds * sampleRate))
  const out = new Float32Array(total)
  if (!Number.isFinite(spec.bpm) || spec.bpm <= 0) return out

  const density = Math.max(0, Math.min(1, spec.density ?? 0.5))
  const swing = Math.max(0, Math.min(0.5, spec.swing ?? 0))
  const tone = Math.max(0, Math.min(1, spec.tone ?? 0.45))
  const rand = prng(`pulse:${spec.seed}`)
  const beatSeconds = 60 / spec.bpm
  const tonicHz = midiToHz(spec.tonic - 12)
  const fifthHz = midiToHz(degreeToMidi(4, spec.mode, spec.tonic))
  const octHz = midiToHz(spec.tonic + 12)
  const twoPi = Math.PI * 2
  const invSr = 1 / sampleRate

  const addHit = (atSeconds: number, kind: 'low' | 'mid' | 'tick', vel: number) => {
    const start = Math.round(atSeconds * sampleRate)
    if (start >= total) return
    const dur = kind === 'low' ? 0.24 : kind === 'mid' ? 0.14 : 0.07
    const len = Math.min(total - Math.max(0, start), Math.round(dur * sampleRate))
    if (len <= 0) return
    const fBase = kind === 'low' ? Math.max(48, Math.min(110, tonicHz)) : kind === 'mid' ? fifthHz : octHz * (1 + tone * 0.5)
    let phase = 0
    for (let k = 0; k < len; k++) {
      const idx = start + k
      if (idx < 0) continue
      const t = k * invSr
      const attack = Math.min(1, t / 0.003)
      const decay = Math.exp(-t / (kind === 'low' ? 0.075 : kind === 'mid' ? 0.042 : 0.018))
      const pitchDrop = kind === 'low' ? 1 + 0.9 * Math.exp(-t / 0.018) : 1 + 0.25 * Math.exp(-t / 0.008)
      phase += twoPi * (fBase * pitchDrop) * invSr
      const click = kind === 'tick' ? Math.sin(phase * 2.7) * tone * 0.4 : Math.sin(phase * 2) * tone * 0.15
      out[idx] = out[idx]! + (Math.sin(phase) + click) * attack * decay * vel
    }
  }

  const beats = Math.ceil(spec.seconds / beatSeconds)
  for (let b = 0; b < beats; b++) {
    const step = b % 4
    const t0 = b * beatSeconds
    const human = 0.88 + rand() * 0.24
    if (step === 0) {
      addHit(t0, 'low', 0.65 * human)
    } else if (step === 2 && density >= 0.2) {
      addHit(t0, 'mid', 0.36 * human)
    } else if (density >= 0.45) {
      addHit(t0, 'tick', (0.2 + 0.14 * density) * human)
    }
    if (density >= 0.72) {
      const off = t0 + beatSeconds * (0.5 + swing * 0.32)
      if (off < spec.seconds) addHit(off, 'tick', 0.14 * (0.8 + rand() * 0.4))
    }
  }

  // soft clip for safety
  for (let i = 0; i < total; i++) out[i] = Math.tanh(out[i]! * 1.1) * 0.7
  return out
}

/**
 * Renders an evolving hypnotic tribal, slow-trance, or cavernous ritual drum
 * Track locked to `bpm` and tuned to the Song's tonic and fifth. Strictly silent
 * in free time (`bpm <= 0`). Energy smoothly evolves from `intensity` to `build`.
 */
export function renderDrums(spec: Extract<SynthSpec, { kind: 'drums' }>, sampleRate = synthRate): Float32Array {
  const total = Math.max(1, Math.round(spec.seconds * sampleRate))
  const out = new Float32Array(total)
  if (!Number.isFinite(spec.bpm) || spec.bpm <= 0) return out

  const style = spec.style ?? 'tribal'
  const startIntensity = Math.max(0, Math.min(1, spec.intensity ?? 0.5))
  const endIntensity = Math.max(0, Math.min(1, spec.build ?? startIntensity))
  const swing = Math.max(0, Math.min(0.4, spec.swing ?? 0.08))
  const half = spec.halfTime ? 2 : 1
  const rand = prng(`drums:${spec.seed}`)
  const noiseRand = prng(`drums-noise:${spec.seed}`)

  const beatSeconds = (60 / spec.bpm) * half
  const stepSeconds = beatSeconds / 4 // 16th-note grid
  const lowHz = Math.max(48, Math.min(82, midiToHz(spec.tonic - 12)))
  const tomLowHz = Math.max(88, Math.min(150, midiToHz(spec.tonic)))
  const tomHighHz = Math.max(132, Math.min(220, midiToHz(degreeToMidi(4, spec.mode, spec.tonic))))
  const bellHz = Math.max(260, Math.min(520, midiToHz(degreeToMidi(4, spec.mode, spec.tonic + 12))))
  const twoPi = Math.PI * 2
  const invSr = 1 / sampleRate

  const addDeep = (atSeconds: number, vel: number, punch = 1) => {
    const start = Math.round(atSeconds * sampleRate)
    if (start >= total) return
    const dur = style === 'ritual' ? 0.42 : 0.28
    const len = Math.min(total - Math.max(0, start), Math.round(dur * sampleRate))
    if (len <= 0) return
    let phase = 0
    for (let k = 0; k < len; k++) {
      const idx = start + k
      if (idx < 0) continue
      const t = k * invSr
      const attack = Math.min(1, t / 0.0025)
      const decay = Math.exp(-t / (style === 'ritual' ? 0.13 : 0.085))
      const pitch = 1 + (1.25 * punch) * Math.exp(-t / 0.02)
      phase += twoPi * lowHz * pitch * invSr
      const slap = t < 0.012 ? (noiseRand() * 2 - 1) * Math.exp(-t / 0.004) * 0.22 : 0
      const body = Math.sin(phase) + 0.18 * Math.sin(phase * 2)
      out[idx] = out[idx]! + (body + slap) * attack * decay * vel
    }
  }

  const addTom = (atSeconds: number, hz: number, vel: number) => {
    const start = Math.round(atSeconds * sampleRate)
    if (start >= total) return
    const len = Math.min(total - Math.max(0, start), Math.round(0.22 * sampleRate))
    if (len <= 0) return
    let phase = 0
    for (let k = 0; k < len; k++) {
      const idx = start + k
      if (idx < 0) continue
      const t = k * invSr
      const attack = Math.min(1, t / 0.002)
      const decay = Math.exp(-t / 0.055)
      const pitch = 1 + 0.38 * Math.exp(-t / 0.016)
      phase += twoPi * hz * pitch * invSr
      const slap = t < 0.009 ? (noiseRand() * 2 - 1) * Math.exp(-t / 0.003) * 0.28 : 0
      out[idx] = out[idx]! + (Math.sin(phase) + 0.16 * Math.sin(phase * 1.59) + slap) * attack * decay * vel
    }
  }

  const addRim = (atSeconds: number, vel: number) => {
    const start = Math.round(atSeconds * sampleRate)
    if (start >= total) return
    const len = Math.min(total - Math.max(0, start), Math.round(0.065 * sampleRate))
    if (len <= 0) return
    const f = tomHighHz * 3.1
    let p1 = 0
    let p2 = 0
    for (let k = 0; k < len; k++) {
      const idx = start + k
      if (idx < 0) continue
      const t = k * invSr
      const env = Math.min(1, t / 0.001) * Math.exp(-t / 0.014)
      p1 += twoPi * f * invSr
      p2 += twoPi * (f * 2.42) * invSr
      const snap = t < 0.007 ? (noiseRand() * 2 - 1) * 0.45 : 0
      out[idx] = out[idx]! + (0.65 * Math.sin(p1) + 0.35 * Math.sin(p2) + snap) * env * vel
    }
  }

  const addShaker = (atSeconds: number, vel: number, open: boolean, bright: number) => {
    const start = Math.round(atSeconds * sampleRate)
    if (start >= total) return
    const dur = open ? 0.13 : 0.048
    const len = Math.min(total - Math.max(0, start), Math.round(dur * sampleRate))
    if (len <= 0) return
    let prev = 0
    let lp = 0
    const alpha = 0.25 + 0.55 * bright
    for (let k = 0; k < len; k++) {
      const idx = start + k
      if (idx < 0) continue
      const t = k * invSr
      const env = Math.min(1, t / (open ? 0.004 : 0.008)) * Math.exp(-t / (open ? 0.042 : 0.016))
      const white = noiseRand() * 2 - 1
      // high-pass then brightness-controlled smoothing for silky shaker/hat
      const hp = white - prev * 0.86
      prev = white
      lp += alpha * (hp - lp)
      out[idx] = out[idx]! + lp * env * vel
    }
  }

  const addBell = (atSeconds: number, vel: number) => {
    const start = Math.round(atSeconds * sampleRate)
    if (start >= total) return
    const len = Math.min(total - Math.max(0, start), Math.round(0.75 * sampleRate))
    if (len <= 0) return
    let p1 = 0
    let p2 = 0
    let p3 = 0
    for (let k = 0; k < len; k++) {
      const idx = start + k
      if (idx < 0) continue
      const t = k * invSr
      const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.24)
      p1 += twoPi * bellHz * invSr
      p2 += twoPi * (bellHz * 2.01) * invSr
      p3 += twoPi * (bellHz * 2.98) * invSr
      out[idx] = out[idx]! + (0.6 * Math.sin(p1) + 0.28 * Math.sin(p2) + 0.12 * Math.sin(p3)) * env * vel
    }
  }

  const totalSteps = Math.ceil(spec.seconds / stepSeconds)
  const rising = endIntensity > startIntensity + 0.2
  for (let s = 0; s < totalSteps; s++) {
    const bar = Math.floor(s / 16)
    const step = s % 16
    const swingOffset = step % 2 === 1 ? swing * stepSeconds * 0.5 : 0
    const t0 = s * stepSeconds + swingOffset
    if (t0 >= spec.seconds) break
    const progress = t0 / Math.max(0.001, spec.seconds)
    const energy = Math.max(0, Math.min(1, startIntensity + (endIntensity - startIntensity) * progress))
    const human = 0.88 + rand() * 0.24
    const finalRamp = rising && spec.seconds - t0 < beatSeconds * 4

    if (style === 'tribal') {
      // hypnotic 3-3-2 + 4/4 frame-drum & hand-tom dialogue that layers up with energy
      if (step === 0) addDeep(t0, (0.52 + 0.34 * energy) * human, 0.8 + 0.5 * energy)
      if (step === 6 && energy >= 0.16) addDeep(t0, (0.24 + 0.26 * energy) * human, 0.7)
      if (step === 8 && energy >= 0.42) addDeep(t0, (0.34 + 0.28 * energy) * human, 0.9)
      if (step === 12 && energy >= 0.65) addDeep(t0, (0.28 + 0.22 * energy) * human, 0.75)

      // syncopated tribal toms
      if ((step === 3 || step === 10) && energy >= 0.24) addTom(t0, tomLowHz, (0.22 + 0.28 * energy) * human)
      if ((step === 4 || step === 14) && energy >= 0.36) addTom(t0, tomHighHz, (0.18 + 0.26 * energy) * human)
      if (step === 11 && energy >= 0.58) addTom(t0, tomHighHz * 1.12, (0.16 + 0.2 * energy) * human)

      // wooden clave / rim accents
      if ((step === 4 || step === 12) && energy >= 0.48) addRim(t0, (0.12 + 0.18 * energy) * human)

      // breathing 16th shaker texture
      if (energy >= 0.32 && (step % 2 === 0 || energy >= 0.6)) {
        const accent = step % 4 === 2 ? 1.35 : 0.75
        addShaker(t0, (0.06 + 0.16 * energy) * accent * human, step === 2 || step === 10, energy)
      }

      // end-of-4-bar turnaround or final pre-drop rolling tom tension
      if ((bar % 4 === 3 && step >= 12 && energy >= 0.55) || (finalRamp && step % 2 === 0)) {
        const rampGain = finalRamp ? 0.25 + 0.35 * (1 - (spec.seconds - t0) / (beatSeconds * 4)) : 0.24 * energy
        addTom(t0, step % 4 === 0 ? tomLowHz : tomHighHz, rampGain * human)
      }
    } else if (style === 'trance') {
      // hypnotic slow-trance four-on-the-floor + offbeat hats + rolling 16th ghost groove
      if (step % 4 === 0) addDeep(t0, (0.56 + 0.32 * energy) * human, 1.0 + 0.4 * energy)
      if (step % 4 === 2 && energy >= 0.22) addShaker(t0, (0.12 + 0.22 * energy) * human, true, 0.4 + 0.6 * energy)
      if (step % 2 === 1 && energy >= 0.45) addShaker(t0, (0.05 + 0.1 * energy) * human, false, 0.35 + 0.55 * energy)
      if ((step === 4 || step === 12) && energy >= 0.35) addRim(t0, (0.14 + 0.2 * energy) * human)
      if ((step === 6 || step === 14) && energy >= 0.55) addTom(t0, tomLowHz, (0.18 + 0.22 * energy) * human)
      if (finalRamp && step % 2 === 0) addTom(t0, tomHighHz, (0.2 + 0.28 * energy) * human)
    } else {
      // cavernous ritual: deep boom on 1, answering low tom on 3, distant shimmer bell every 2 bars
      if (step === 0) addDeep(t0, (0.55 + 0.3 * energy) * human, 0.9)
      if (step === 0 && bar % 2 === 0 && energy >= 0.18) addBell(t0, (0.1 + 0.16 * energy) * human)
      if (step === 8 && energy >= 0.22) addTom(t0, tomLowHz, (0.24 + 0.26 * energy) * human)
      if (step === 12 && energy >= 0.48) addTom(t0, tomHighHz, (0.16 + 0.2 * energy) * human)
      if (step % 4 === 2 && energy >= 0.38) addShaker(t0, (0.07 + 0.12 * energy) * human, true, 0.3 + 0.5 * energy)
    }
  }

  // soft clip & click-free end ramp
  const edge = Math.min(Math.round(0.015 * sampleRate), Math.floor(total / 2))
  for (let i = 0; i < total; i++) {
    let env = 1
    if (i >= total - edge) env = (total - 1 - i) / edge
    out[i] = Math.tanh(out[i]! * 1.15) * 0.72 * env
  }
  return out
}

export function renderSynth(spec: SynthSpec, sampleRate = synthRate): Float32Array {
  if (spec.kind === 'drone') return renderDrone(spec, sampleRate)
  if (spec.kind === 'drums') return renderDrums(spec, sampleRate)
  return renderPulse(spec, sampleRate)
}

/** Renders a procedural Track sound to a 48 kHz WAV file (for loudness measurement, Studio mixdown, and CLI playback). */
export async function synthInto(spec: SynthSpec, outFile?: string): Promise<{ file: string; seconds: number; synth: SynthSpec }> {
  const samples = renderSynth(spec, synthRate)
  const hash = createHash('sha256').update(JSON.stringify(spec)).digest('hex')
  const target = outFile ?? `${vocalsDir}/synth-${spec.kind}-${hash}.wav`
  const file = await makeOnce(target, async (partial) => {
    await writeFile(partial, encodeWav(samples, synthRate))
  })
  return { file, seconds: spec.seconds, synth: spec }
}
