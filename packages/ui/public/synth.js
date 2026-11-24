// Deterministic procedural 48 kHz PCM synthesis for non-MusicGen Tracks
// (`drone` and `pulse`) in the browser Receiver. Mirrors `packages/vocals/lib/synth.ts`
// sample-for-sample so late joins and Studio loudness measurements agree.
(() => {
  const synthRate = 48000
  const modeSteps = {
    ionian: [0, 2, 4, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
  }
  const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12)
  const degreeToMidi = (degree, mode, tonic) => {
    const scale = modeSteps[mode] ?? modeSteps.aeolian
    const octaves = Math.floor(degree / 7)
    const step = ((degree % 7) + 7) % 7
    return tonic + octaves * 12 + scale[step]
  }
  const prng = (seed) => {
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

  function renderDrone(spec, sampleRate = synthRate) {
    const total = Math.max(1, Math.round(spec.seconds * sampleRate))
    const out = new Float32Array(total)
    const warmth = Math.max(0, Math.min(1, spec.warmth ?? 0.55))
    const movement = Math.max(0, Math.min(1, spec.movement ?? 0.4))
    const octaveShift = Math.max(-1, Math.min(1, Math.round(spec.octave ?? 0))) * 12
    const baseTonic = spec.tonic + octaveShift
    const chords = spec.chords ?? []
    const rand = prng(`drone:${spec.seed}`)

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

    const glide = 1 - Math.exp(-1 / (0.18 * sampleRate))
    const cutoff = 280 + warmth * 1250
    const lpAlpha = Math.min(0.95, (2 * Math.PI * cutoff) / (2 * Math.PI * cutoff + sampleRate))
    let lp = 0
    let chordIdx = 0

    const edgeRamp = Math.min(Math.round(0.03 * sampleRate), Math.floor(total / 2))
    const twoPi = Math.PI * 2
    const invSr = 1 / sampleRate
    const detune = 0.0025 + movement * 0.004

    for (let i = 0; i < total; i++) {
      const t = i * invSr
      while (chordIdx < chords.length - 1 && t >= chords[chordIdx].at + chords[chordIdx].seconds) {
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

      const raw =
        0.42 * Math.sin(pRoot) +
        0.16 * Math.sin(pSub) +
        0.16 * breathA * Math.sin(pFifthA) +
        0.16 * breathB * Math.sin(pFifthB) +
        (0.08 + 0.12 * warmth) * breathB * Math.sin(pOct) +
        (0.04 + 0.08 * warmth) * breathA * Math.sin(pThird)

      lp += lpAlpha * (raw - lp)
      let env = 1
      if (i < edgeRamp) env = i / edgeRamp
      else if (i >= total - edgeRamp) env = (total - 1 - i) / edgeRamp
      out[i] = Math.tanh(lp * 1.15) * 0.55 * env
    }
    return out
  }

  function renderPulse(spec, sampleRate = synthRate) {
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

    const addHit = (atSeconds, kind, vel) => {
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
        out[idx] += (Math.sin(phase) + click) * attack * decay * vel
      }
    }

    const beats = Math.ceil(spec.seconds / beatSeconds)
    for (let b = 0; b < beats; b++) {
      const step = b % 4
      const t0 = b * beatSeconds
      const human = 0.88 + rand() * 0.24
      if (step === 0) addHit(t0, 'low', 0.65 * human)
      else if (step === 2 && density >= 0.2) addHit(t0, 'mid', 0.36 * human)
      else if (density >= 0.45) addHit(t0, 'tick', (0.2 + 0.14 * density) * human)
      if (density >= 0.72) {
        const off = t0 + beatSeconds * (0.5 + swing * 0.32)
        if (off < spec.seconds) addHit(off, 'tick', 0.14 * (0.8 + rand() * 0.4))
      }
    }

    for (let i = 0; i < total; i++) out[i] = Math.tanh(out[i] * 1.1) * 0.7
    return out
  }

  globalThis.ikuradioSynth = {
    render(spec) {
      if (!spec) return undefined
      return spec.kind === 'drone' ? renderDrone(spec, synthRate) : renderPulse(spec, synthRate)
    },
  }
})()
