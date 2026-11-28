// Chimera's speaking throat in the Studio and CLI: runs the exact same
// WebAssembly module and CMU dictionary the browser Receiver uses
// (`packages/ui/public/throat/speech/`), so spoken Parts have sample-exact
// duration, typing segments, and EBU R128 loudness in Studio and Receiver.

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import type { BodyMix, VoiceLang } from 'melody'
import { makeOnce, vocalsDir } from './chimera.js'

export type SpeechSpec = {
  text: string
  body: 'female' | 'male' | 'child' | BodyMix
  lang?: VoiceLang
  f0?: number
  rate?: number
  accent?: number
  stretch?: [number, number][]
  pressure?: number
  tension?: number
  breathiness?: number
  brightness?: number
  roughness?: number
  fry?: number
  vibratoRate?: number
  glide?: number
  drift?: number
  epilarynx?: number
  ventricular?: number
}

export const speechRate = 48000

export type SpeechSegment = {
  phoneme: string
  start: number
  end: number
  stress?: number
  kind?: string
}

type OpenedSpeech = {
  say: (request: SpeechSpec) => { samples: Float32Array; end: number; segments: SpeechSegment[] }
}

const speechDir = new URL('../../ui/public/throat/speech/', import.meta.url)

let opened: Promise<OpenedSpeech> | undefined

async function openLocalSpeech(): Promise<OpenedSpeech> {
  opened ??= (async () => {
    const [engine, dictGz] = await Promise.all([
      readFile(new URL('chimera.wasm', speechDir)),
      readFile(new URL('cmudict.txt.gz', speechDir)),
    ])
    const dictionary = gunzipSync(dictGz).toString('utf8')
    const module = await WebAssembly.compile(engine)
    const instance = await WebAssembly.instantiate(module, {})
    const x = instance.exports as {
      memory: WebAssembly.Memory
      chimera_alloc: (len: number) => number
      chimera_free: (ptr: number, len: number) => void
      chimera_call: (ptr: number, len: number) => number
      chimera_result_ptr: () => number
      chimera_result_len: () => number
      chimera_sung_ptr: () => number
      chimera_sung_len: () => number
    }
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const call = (request: Record<string, unknown>) => {
      const bytes = encoder.encode(JSON.stringify(request))
      const at = x.chimera_alloc(bytes.length)
      new Uint8Array(x.memory.buffer, at, bytes.length).set(bytes)
      const failed = x.chimera_call(at, bytes.length)
      x.chimera_free(at, bytes.length)
      const answer = JSON.parse(
        decoder.decode(new Uint8Array(x.memory.buffer, x.chimera_result_ptr(), x.chimera_result_len())),
      )
      if (failed) throw new Error(answer.error)
      return answer
    }
    call({ fn: 'g2pLoad', text: dictionary })
    return {
      say(request: SpeechSpec) {
        const said = call({ fn: 'say', sampleRate: speechRate, ...request })
        const samples = new Float32Array(x.memory.buffer, x.chimera_sung_ptr(), x.chimera_sung_len()).slice()
        return { samples, end: said.end as number, segments: (said.segments ?? []) as SpeechSegment[] }
      },
    }
  })()
  return opened
}

/** Encodes mono 32-bit float samples (-1..1) as a 16-bit PCM WAV buffer. */
export function encodeWav(samples: Float32Array, sampleRate = speechRate): Buffer {
  const bytesPerSample = 2
  const dataBytes = samples.length * bytesPerSample
  const buffer = Buffer.alloc(44 + dataBytes)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // PCM fmt chunk size
  buffer.writeUInt16LE(1, 20) // PCM format
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28)
  buffer.writeUInt16LE(bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!))
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2)
  }
  return buffer
}

/**
 * Speaks `speech` through Chimera's speaking throat and writes it as a 48 kHz WAV
 * under `vocalsDir` (or `outFile` when given, e.g. for the CLI Receiver).
 */
export async function speakInto(
  speech: SpeechSpec,
  outFile?: string,
): Promise<{ file: string; seconds: number; segments: SpeechSegment[]; speech: SpeechSpec }> {
  const throat = await openLocalSpeech()
  const { samples, end, segments } = throat.say(speech)
  const seconds = Math.max(end, samples.length / speechRate)
  const hash = createHash('sha256').update(JSON.stringify(speech)).digest('hex')
  const target = outFile ?? `${vocalsDir}/speech-${hash}.wav`
  const file = await makeOnce(target, async (partial) => {
    await writeFile(partial, encodeWav(samples, speechRate))
  })
  return { file, seconds, segments, speech }
}
