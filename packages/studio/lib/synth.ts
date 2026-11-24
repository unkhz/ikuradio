// Procedural Track rendering in the Studio (`drone`, `pulse`, and `drums`): builds
// deterministic `SynthSpec` payloads from the timeline, mode, tonic, tempo map,
// and hummed guide chords, then renders WAVs via `vocals` so the Studio can
// measure exact EBU R128 loudness and mix rehearsals. Only the declarative
// `SynthSpec` is written to the Session; Receivers render the exact same audio.

import { keyFor } from 'melody'
import type { Mood } from 'mood'
import { synthInto, type Placed, type SynthSpec } from 'vocals'
import type { Asking } from './asking.js'
import type { Guide } from './guide.js'

export type KeyedSynth = Placed & {
  key: string
  track: 'drone' | 'pulse' | 'drums'
  synth: SynthSpec
}

/**
 * Renders every `drone`, `pulse`, and `drums` placing in `pass`. A `pulse` or
 * `drums` placing under free time (`bpm === null`) produces nothing.
 */
export async function renderSynths(
  asking: Asking,
  pass: number,
  mood: Mood,
  guides: readonly Guide[],
  songNumber: string,
): Promise<KeyedSynth[]> {
  const asked = asking.passes[pass]
  if (!asked) return []
  const offset = asking.resolved.regions[asked.regions[0]!.global]!.startSeconds
  const tonic = keyFor('male', mood.character.mode).tonic
  const results: KeyedSynth[] = []

  // collect guide chords in Song-relative seconds (callers pass guides with `at` relative to `pass` offset, or Song-wide guides when `guidesAtSong` is true)
  const allChords = guides
    .flatMap((guide) => {
      if (!guide.composed?.chords?.length) return []
      const bpm = guide.score.bpm || mood.character.tempo
      const secPerBeat = 60 / bpm
      return guide.composed.chords.map((c) => ({
        at: guide.at + c.at * secPerBeat,
        seconds: c.beats * secPerBeat,
        root: c.root,
        bass: c.bass,
      }))
    })
    .sort((a, b) => a.at - b.at)

  for (const making of asked.drones) {
    for (const [n, placing] of making.placings.entries()) {
      const at = placing.at - offset
      const end = at + placing.seconds
      const overlapping = allChords
        .filter((c) => c.at + c.seconds > at && c.at < end)
        .map((c) => ({
          at: Math.max(0, Math.round((c.at - at) * 1000) / 1000),
          seconds: Math.round(Math.min(end - Math.max(at, c.at), c.seconds) * 1000) / 1000,
          root: c.root,
          bass: c.bass,
        }))
        .filter((c) => c.seconds > 0)
      const params = placing.parameters ?? {}
      const spec: Extract<SynthSpec, { kind: 'drone' }> = {
        kind: 'drone',
        mode: mood.character.mode,
        tonic,
        seconds: Math.round(placing.seconds * 1000) / 1000,
        ...(placing.fadeIn ? { fadeIn: placing.fadeIn } : {}),
        ...(placing.fadeOut ? { fade: placing.fadeOut } : {}),
        ...(overlapping.length ? { chords: overlapping } : {}),
        ...(typeof params.warmth === 'number' ? { warmth: params.warmth } : {}),
        ...(typeof params.build === 'number' ? { build: params.build } : {}),
        ...(typeof params.movement === 'number' ? { movement: params.movement } : {}),
        ...(typeof params.octave === 'number' ? { octave: params.octave } : {}),
        seed: `${songNumber}:${pass}:${making.key}:${n}`,
      }
      const { file } = await synthInto(spec)
      results.push({
        key: making.key,
        track: 'drone',
        file,
        at,
        gain: placing.gain,
        seconds: Math.max(0, placing.seconds - placing.fadeOut),
        ...(placing.fadeIn ? { fadeIn: placing.fadeIn } : {}),
        ...(placing.fadeOut ? { fade: placing.fadeOut } : {}),
        synth: spec,
      })
    }
  }

  for (const making of asked.pulses) {
    for (const [n, placing] of making.placings.entries()) {
      // pulse is strictly silent in free time
      if (placing.bpm === null || !(placing.bpm > 0)) continue
      const at = placing.at - offset
      const params = placing.parameters ?? {}
      const spec: Extract<SynthSpec, { kind: 'pulse' }> = {
        kind: 'pulse',
        mode: mood.character.mode,
        tonic,
        bpm: placing.bpm,
        seconds: Math.round(placing.seconds * 1000) / 1000,
        ...(placing.fadeIn ? { fadeIn: placing.fadeIn } : {}),
        ...(placing.fadeOut ? { fade: placing.fadeOut } : {}),
        ...(typeof params.density === 'number' ? { density: params.density } : {}),
        ...(typeof params.swing === 'number' ? { swing: params.swing } : {}),
        ...(typeof params.tone === 'number' ? { tone: params.tone } : {}),
        seed: `${songNumber}:${pass}:${making.key}:${n}`,
      }
      const { file } = await synthInto(spec)
      results.push({
        key: making.key,
        track: 'pulse',
        file,
        at,
        gain: placing.gain,
        seconds: Math.max(0, placing.seconds - placing.fadeOut),
        ...(placing.fadeIn ? { fadeIn: placing.fadeIn } : {}),
        ...(placing.fadeOut ? { fade: placing.fadeOut } : {}),
        synth: spec,
      })
    }
  }

  for (const making of asked.drums) {
    for (const [n, placing] of making.placings.entries()) {
      // drums are strictly silent in free time
      if (placing.bpm === null || !(placing.bpm > 0)) continue
      const at = placing.at - offset
      const params = placing.parameters ?? {}
      const style = params.style === 'trance' || params.style === 'ritual' ? params.style : 'tribal'
      const spec: Extract<SynthSpec, { kind: 'drums' }> = {
        kind: 'drums',
        style,
        mode: mood.character.mode,
        tonic,
        bpm: placing.bpm,
        seconds: Math.round(placing.seconds * 1000) / 1000,
        ...(placing.fadeIn ? { fadeIn: placing.fadeIn } : {}),
        ...(placing.fadeOut ? { fade: placing.fadeOut } : {}),
        ...(typeof params.intensity === 'number' ? { intensity: params.intensity } : {}),
        ...(typeof params.build === 'number' ? { build: params.build } : {}),
        ...(typeof params.swing === 'number' ? { swing: params.swing } : {}),
        ...(typeof params.halfTime === 'number' ? { halfTime: params.halfTime } : {}),
        seed: `${songNumber}:${pass}:${making.key}:${n}`,
      }
      const { file } = await synthInto(spec)
      results.push({
        key: making.key,
        track: 'drums',
        file,
        at,
        gain: placing.gain,
        seconds: Math.max(0, placing.seconds - placing.fadeOut),
        ...(placing.fadeIn ? { fadeIn: placing.fadeIn } : {}),
        ...(placing.fadeOut ? { fade: placing.fadeOut } : {}),
        synth: spec,
      })
    }
  }

  return results
}
