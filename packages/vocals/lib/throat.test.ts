import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { firstTune, setLine } from 'melody'
import { throatScore } from './chimera.js'
import { run } from './exec.js'
import { humanize } from './humanize.js'
import { composeScat } from './scat.js'
import { firstChoir, throatOf } from './singers.js'
import { throatName } from './throat.js'

const home = new URL('../.chimera/', import.meta.url).pathname
const native = `${home}target/release/chimera`
const page = new URL('../../ui/public/', import.meta.url).pathname
const built = existsSync(native) && existsSync(`${page}throat/chimera.wasm`)

/** The samples of a 32-bit float WAV, as the throat writes them. */
function samplesOf(file: string) {
  const wav = readFileSync(file)
  for (let at = 12; at < wav.length; ) {
    const id = wav.toString('ascii', at, at + 4)
    const size = wav.readUInt32LE(at + 4)
    if (id === 'data') return new Float32Array(wav.buffer.slice(wav.byteOffset + at + 8, wav.byteOffset + at + 8 + size))
    at += 8 + size
  }
  throw new Error(`${file}: no data`)
}

describe('the throat', () => {
  it('is named by its revision and its patch', () => {
    expect(throatName()).toMatch(/^6281c32\+[0-9a-f]{12}$/)
  })

  it.skipIf(!built)('sings a take in a Receiver exactly as the Studio sings it', async () => {
    const [lead] = firstChoir
    const score = setLine({
      part: 'verse',
      line: 0,
      lyrics: 'the river keeps 12 colours of night',
      syllables: 9,
      singer: lead.body,
      harmony: lead.harmony,
      tune: firstTune,
    })
    let n = 0
    const random = () => ((n = (n * 9301 + 49297) % 233280) / 233280)
    const take = throatScore({ ...humanize(score, 'throat-test'), ...throatOf(random, 'soft') })

    const dir = await mkdtemp(join(tmpdir(), 'ikuradio-throat-'))
    try {
      await writeFile(join(dir, 'take.json'), JSON.stringify(take))
      await run(native, ['--float', 'render', 'notes', join(dir, 'take.json'), join(dir, 'studio'), lead.body])
      const studio = samplesOf(join(dir, 'studio.wav'))

      const { openThroat } = await import(`${page}throat.js`)
      const throat = await openThroat(
        readFileSync(`${page}throat/chimera.wasm`),
        gunzipSync(readFileSync(`${page}throat/cmudict.txt.gz`)).toString(),
      )
      // the take goes the way it goes in a Session: as JSON
      const receiver: Float32Array = throat.sing(JSON.parse(JSON.stringify(take)), lead.body)

      expect(receiver.length).toBe(studio.length)
      expect(receiver.every((sample, i) => sample === studio[i])).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)

  it.skipIf(!built)('sings an explicit IPA syllables take in a Receiver identically to the Studio', async () => {
    const [lead] = firstChoir
    const notes: [number, number][] = [
      [64, 0.5], [67, 0.5], [69, 1], [67, 0.5], [64, 0.5], [62, 1], [60, 2], [0, 1],
    ]
    let n = 0
    const random = () => ((n = (n * 9301 + 49297) % 233280) / 233280)
    const scatted = composeScat(['ʙo', 'pfa', 'tɾi', 'kø', 'ʙu', 'tsak'], notes, random)
    const take = throatScore({
      ...humanize({ bpm: 88, lyrics: scatted.lyrics, syllables: scatted.syllables, notes }, 'throat-ipa-test'),
      ...throatOf(random, 'plain'),
    })

    const dir = await mkdtemp(join(tmpdir(), 'ikuradio-throat-ipa-'))
    try {
      await writeFile(join(dir, 'take.json'), JSON.stringify(take))
      await run(native, ['--float', 'render', 'notes', join(dir, 'take.json'), join(dir, 'studio'), lead.body])
      const studio = samplesOf(join(dir, 'studio.wav'))

      const { openThroat } = await import(`${page}throat.js`)
      const throat = await openThroat(
        readFileSync(`${page}throat/chimera.wasm`),
        gunzipSync(readFileSync(`${page}throat/cmudict.txt.gz`)).toString(),
      )
      const receiver: Float32Array = throat.sing(JSON.parse(JSON.stringify(take)), lead.body)

      expect(receiver.length).toBe(studio.length)
      expect(receiver.length).toBeGreaterThan(48_000)
      expect(receiver.every((sample, i) => sample === studio[i])).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)

  it.skipIf(!built)('sings a native lang: "fi" take with Chimera timbre controls identically in Studio and Receiver', async () => {
    const notes: [number, number][] = [
      [64, 0.5], [64, 0.5], [67, 0.5], [67, 0.5], [69, 0.5], [69, 0.5], [67, 1.5], [0, 1],
    ]
    const take = throatScore({
      bpm: 84,
      lang: 'fi',
      lyrics: 'Lumous kietoo alla jään',
      notes,
      t0: 0.25,
      vibrato: 35,
      vibratoRate: 5.8,
      pressure: 9.2,
      tension: 0.55,
      breathiness: 0.14,
      brightness: 0.65,
      epilarynx: 0.4,
      body: { female: 0.85, child: 0.1 },
    })

    const dir = await mkdtemp(join(tmpdir(), 'ikuradio-throat-fi-'))
    try {
      await writeFile(join(dir, 'take.json'), JSON.stringify(take))
      await run(native, ['--float', 'render', 'notes', join(dir, 'take.json'), join(dir, 'studio'), 'female'])
      const studio = samplesOf(join(dir, 'studio.wav'))

      const { openThroat } = await import(`${page}throat.js`)
      const throat = await openThroat(
        readFileSync(`${page}throat/chimera.wasm`),
        gunzipSync(readFileSync(`${page}throat/cmudict.txt.gz`)).toString(),
      )
      const receiver: Float32Array = throat.sing(JSON.parse(JSON.stringify(take)), 'female')

      expect(receiver.length).toBe(studio.length)
      expect(receiver.length).toBeGreaterThan(48_000)
      expect(receiver.every((sample, i) => sample === studio[i])).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
