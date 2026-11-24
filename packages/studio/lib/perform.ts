// A performance: every line of an iteration set to its tune, in the mode
// and tempo of the Mood, sung by the choir, and laid out in time.
//
// The lead sings every line. The rest of the choir joins in the chorus.
// Every voice sings its own take, a little wrong in its own way, and the
// takes are blended into one recording per line.
//
// With two voices (`twoVoices`), every line is fitted to its bars first,
// and the lead's pitches are written over its section's guide before
// anyone sings (./written.ts).

import { getEnv } from 'tools'
import { chordsHeard, harmonizeChoir, keyFor, modes, scoreSeconds, setBridge, setLine, wrongness, type ChordSource, type Phrase, type Score, type Syllables } from 'melody'
import { blend, countSyllables, fullness, humanize, keepsPace, quickest, record, speakInto, throatScore, type SpeechSpec, type Take, type Throat } from 'vocals'
import type { Part as PartDef, WordMode } from 'parts'
import type { Melody } from 'perspectives'
import type { Iteration } from './compose.js'
import { stressedLine } from './stressed.js'
import { twoVoices } from './guide.js'
import { sungAs, writeSections, type Fitted, type Unwritten, type Written } from './written.js'
import { progressionOf } from './progression.js'

export type SungLine = {
  part: string
  /** The region index within the iteration, so consecutive wordless sections never merge in `sections()`. */
  region?: number
  /** Word mode of the region (`written`, `spoken`, `none`, `silent`). */
  words?: WordMode
  /** Which line of its part, from 0. */
  index: number
  lyrics: string
  /**
   * The whole choir's line as one recording, for the Music to listen to and
   * the rehearsal to mix. Empty if no voice could sing the line.
   */
  file: string
  /**
   * Each singer's own take of the line, as the throat sang it, its
   * recording, and how loud it is: what a Receiver sings, placing each
   * singer where it likes in its mix. The recording stays in the Studio.
   */
  voices: { file: string; voice: number; gain: number; take: Take }[]
  /** For a spoken line: the Chimera speech request synthesized locally by every Receiver. */
  speech?: SpeechSpec
  /** Every recording made for this line: each voice's take, and their blend. */
  recordings: string[]
  /** How long the line lasts, rest included. */
  seconds: number
  /** When the lead voice begins, after its breath, from the start of the line. */
  enters: number
  /** How long the lead voice sings, without the rest. */
  voiced: number
  /** When the line begins, in seconds from the start of the iteration. */
  at: number
  /**
   * A bridge's hum that is recorded but not heard: the Music listens to it,
   * the listeners do not.
   */
  unheard?: boolean
  /** How many whole bars the line grew past its phrase's own: the number's chant, or a bar of grace. */
  grown?: number
  /** The shortest time between two of its lead's syllables, in seconds: the price of time, as it was paid. */
  quickest?: number
  /** For a line written over its section's guide: the guide, and what the lead was written. */
  written?: Written
}

/** How often a bridge is hummed aloud, rather than only played, unless a Perspective says otherwise. */
export const humming = 0.5

/** How loud a bridge's hum is, beside a sung line. */
const humGain = 0.7

/** A hum, one "ooh" for each note: what a singer sings when there are no words. */
export const hum = (notes: number) =>
  Array.from({ length: notes }, () => 'ooh').join(' ')

/**
 * Scat: a percussive syllable a note, drawn from `syllables` by `random`,
 * never the same one twice in a row, the way a singer with no words still
 * keeps the rhythm going.
 */
export function scat(syllables: readonly string[], random: () => number) {
  return (notes: number) => {
    const sung: string[] = []
    for (let i = 0; i < notes; i++) {
      const choices = syllables.length > 1 ? syllables.filter((s) => s !== sung.at(-1)) : syllables
      sung.push(choices[Math.floor(random() * choices.length)]!)
    }
    return sung.join(' ')
  }
}

/** Layers explicit melody parameters from an Arrangement instance over the iteration's Settings (Tides + Perspectives). */
export function melodyFor(base: Melody, parameters?: Readonly<Record<string, number>>): Melody {
  if (!parameters) return base
  return {
    ceiling: parameters.ceiling ?? base.ceiling,
    span: parameters.span ?? base.span,
    travel: parameters.travel ?? base.travel,
  }
}

/** How a section ends: the Arrangement's explicit ending if set, else full for a chorus/refrain or the last section, else half. */
export const endingFor = (part: string, index: number, total: number, explicit?: 'full' | 'half'): 'full' | 'half' =>
  explicit ?? (part === 'chorus' || part === 'refrain' || index === total - 1 ? 'full' : 'half')

/** Applies a per-block `breath` preset (`soft`, `pressed`, or `plain`) on top of a singer's own throat. */
export function throatForBreath(base: Throat | undefined, breath?: string): Throat | undefined {
  if (!breath || breath === 'plain') return base
  if (breath === 'soft') {
    return {
      pressure: base?.pressure ?? 9,
      ...base,
      breathiness: Math.round(Math.min(0.95, (base?.breathiness ?? 0.25) + 0.2) * 1000) / 1000,
      tension: Math.round(Math.max(0.05, (base?.tension ?? 0.45) - 0.15) * 1000) / 1000,
    }
  }
  if (breath === 'pressed') {
    return {
      ...base,
      breathiness: Math.round(Math.max(0.02, (base?.breathiness ?? 0.25) - 0.12) * 1000) / 1000,
      tension: Math.round(Math.min(0.95, (base?.tension ?? 0.45) + 0.2) * 1000) / 1000,
      pressure: Math.round(Math.min(18, (base?.pressure ?? 9) + 2) * 1000) / 1000,
    }
  }
  return base
}

/** A compact suffix distinguishing a region whose melody parameters, tempo, cadence, or voice block overrides differ from the defaults, or empty when default. */
function scopeOf(
  parameters?: Readonly<Record<string, number>>,
  tempo?: number | null,
  ending?: 'full' | 'half',
  voice?: Readonly<Record<string, number | string>>,
): string {
  const parts: string[] = []
  if (tempo !== undefined) parts.push(`bpm=${tempo === null ? 'free' : tempo}`)
  if (ending !== undefined) parts.push(`end=${ending}`)
  if (parameters) {
    for (const key of ['ceiling', 'span', 'travel'] as const) {
      if (parameters[key] !== undefined) parts.push(`${key}=${parameters[key]}`)
    }
  }
  if (voice) {
    for (const key of ['singers', 'breath', 'humanness'] as const) {
      if (voice[key] !== undefined) parts.push(`${key}=${voice[key]}`)
    }
  }
  return parts.length ? `@${parts.join(',')}` : ''
}

/** Where a line stands in the song and what it says. The same line in the same place is sung the same. */
export const lineKey = (part: string, index: number, lyrics: string, scope = '') =>
  `${part}${scope}:${index}:${lyrics}`

export type PerformedPart = {
  type: string
  content: string
  index: number
  /** Word mode of the part (`written`, `spoken`, `none`, `silent`). Defaults from `type` when omitted. */
  words?: WordMode
  /** Part module instance when available, for custom phrases and durations. */
  part?: PartDef
  parameters?: Readonly<Record<string, number>>
  /** Per-block voice overrides (`singers`, `breath`, `humanness`). */
  voice?: Readonly<Record<string, number | string>>
  ending?: 'full' | 'half'
  /** The region's resolved tempo: beats a minute, or null for free time. */
  tempo?: number | null
  /** Fixed duration in seconds, for a free-time region. */
  seconds?: number
}

/**
 * Every line of an iteration, sung. `before` is the iteration before it, as
 * it was sung: with two voices, each line's melody is pulled toward the one
 * it had there, and each section's guide toward its guide.
 */
export async function perform(
  { iteration, mood, choir, sung: tune, song, settings, rate }: Iteration,
  before: readonly SungLine[],
  /** The regions of the iteration, in order, with the words each sings: what the timeline asks (./asking.ts). */
  parts: readonly PerformedPart[],
): Promise<SungLine[]> {
  // the Song's Perspectives, as its hooks here follow them
  const humanness = settings.humanness.scale
  const bridging = settings['bridge-singers']
  const { syllables: scatSyllables } = settings['bridge-voice']

  /**
   * Every singer's score for a line, from the lead's: the lead as it is, the
   * others beside it by the harmonizer, the same for the same line.
   */
  const choirOf = (lead: Score, singers: typeof choir, named: string, chords?: ChordSource): Score[] => {
    const [first, ...others] = singers
    if (!first || others.length === 0) return [lead]
    return [
      lead,
      ...harmonizeChoir({
        lead,
        leadKey: keyFor(first.body, mood.character.mode),
        frame: keyFor('female', mood.character.mode),
        keyOf: (body) => keyFor(body, mood.character.mode),
        voices: others,
        harmony: settings.harmony,
        random: wrongness(`harmony:${song.number}:${named}`),
        chords,
      }),
    ]
  }

  /** How many whole bars a line grew past its phrase, if any. */
  const grownOf = (part: string, index: number, score: Score, explicit?: readonly Phrase[]) => {
    const phrases = explicit?.length ? explicit : part === 'chorus' ? tune.chorus : tune.verse
    const phrase = phrases[index % phrases.length]!
    const beats = (notes: readonly (readonly [number, number])[]) => notes.reduce((sum, [, b]) => sum + b, 0)
    const grown = Math.round((beats(score.notes) - beats(phrase.notes) - phrase.rest) / 4)
    return grown > 0 ? { grown } : {}
  }

  const takes = new Map<string, Promise<Omit<SungLine, 'at'>>>()
  const order: Promise<Omit<SungLine, 'at'>>[] = []

  /** How many notes a line's tune has, before any words bend it. */
  const notesOf = (part: string, index: number, explicit?: readonly Phrase[]) => {
    const phrases = explicit?.length ? explicit : part === 'chorus' ? tune.chorus : tune.verse
    return phrases[index % phrases.length]!.notes.length
  }

  const wordModeOf = (p: PerformedPart): WordMode =>
    p.words ?? p.part?.words ?? (p.type === 'bridge' || p.type === 'interlude' ? 'none' : p.type === 'silence' ? 'silent' : p.type === 'spoken' ? 'spoken' : 'written')

  const phrasesFor = (p: PerformedPart, regionIdx: number): readonly Phrase[] | undefined => {
    if (!p.part) return undefined
    const custom = p.part.phrases(tune, { iteration, last: regionIdx === parts.length - 1, ...(p.ending ? { ending: p.ending } : {}) })
    return custom.length ? custom : undefined
  }

  /**
   * A bridge: the lead hums the last line of the part that has just ended,
   * and the Music plays on. The hum is always recorded, because the Music
   * grows the bridge's bed from it, but only sometimes heard.
   */
  const bridge = async (
    section: number,
    from: string,
    to: string,
    regionTempo?: number | null,
    regionSeconds?: number,
    regionIndex?: number,
  ): Promise<Omit<SungLine, 'at'>> => {
    const [lead] = choir
    // the lead hums, or, in a Song heard that way, the whole choir in its harmonies
    const hummers = bridging.choir ? choir : [lead]
    // the hum walks from where the last part ended to where the next begins
    // a hum, or, in a Song heard that way, scat: the same syllables for every voice, so they sing together
    const sound = scatSyllables?.length ? scat(scatSyllables, wrongness(`scat:${song.number}:${section}`)) : hum
    const bridgeBpm = typeof regionTempo === 'number' ? regionTempo : mood.character.tempo
    let led = setBridge({
      from,
      to,
      lyrics: sound,
      singer: lead.body,
      character: { ...mood.character, tempo: bridgeBpm },
      tune,
      song: song.number,
    })
    // a bridge in free time lasts its own seconds: scale its notes to span them smoothly
    if (regionTempo === null && regionSeconds !== undefined && regionSeconds > 0) {
      const current = scoreSeconds(led)
      if (current > 0) {
        const scale = regionSeconds / current
        led = { ...led, notes: led.notes.map(([pitch, beats]) => [pitch, beats * scale] as [number, number]) }
      }
    }
    const scores = choirOf(led, hummers, `bridge:${section}`)
    const hums = hummers.map((voice, v) => {
      const score = scores[v]!
      const take = {
        // the lead's take is named as it always was
        ...humanize(score, v === 0 ? `${iteration}:bridge:${section}` : `${iteration}:bridge:${section}:${v}`, humanness, rate),
        ...voice.throat,
      }
      // a hum that would come too quickly is never sung: the iteration fails, and is made again
      keepsPace(take, rate, `the bridge ${section} of iteration ${iteration}, voice ${v}`)
      return { voice, v, score, take }
    })
    const { score, take } = hums[0]
    const seconds = scoreSeconds(score)
    const [lastPitch, lastBeats] = score.notes.at(-1) ?? [0, 0]
    const rest = lastPitch === 0 ? lastBeats : 0
    const heard = wrongness(`hum:${iteration}:${section}`)() < bridging.humming
    let file = ''
    const voices: SungLine['voices'] = []
    const recordings: string[] = []
    // a choir humming is fuller than one voice, but not louder than a throat can bear
    const total = hums.reduce((sum, { voice }) => sum + voice.gain * humGain, 0)
    const headroom = Math.min(1, fullness / Math.max(total, humGain))
    for (const { voice, v, take } of hums) {
      try {
        const dry = await record(take, voice.body)
        recordings.push(dry)
        const gain = Math.round(voice.gain * humGain * (v === 0 ? 1 : headroom) * 1000) / 1000
        voices.push({ file: dry, voice: v, gain, take: throatScore(take) })
      } catch (error) {
        console.warn(`a ${voice.body} voice could not hum the bridge: ${error}`)
      }
    }
    if (voices.length > 0) {
      try {
        file = await blend(voices.map(({ file, gain }) => ({ file, gain })))
        recordings.push(file)
      } catch (error) {
        console.warn(`the bridge could not be hummed: ${error}`)
      }
    }
    return {
      part: 'bridge',
      ...(regionIndex !== undefined ? { region: regionIndex } : {}),
      words: 'none',
      index: section,
      lyrics: '',
      file,
      voices,
      recordings: [...new Set(recordings)],
      seconds,
      enters: take.t0,
      voiced: heard ? seconds - (rest * 60) / score.bpm : 0,
      ...(heard ? {} : { unheard: true }),
    }
  }

  /** Who sings this line: per-block `singers` override if set (`solo`, `duet`, `choir`), else classic rule. */
  const singersOf = (part: string, voice?: Readonly<Record<string, number | string>>) => {
    const pick = voice?.singers
    if (pick === 'solo') return choir.slice(0, 1)
    if (pick === 'duet') return choir.slice(0, Math.min(2, choir.length))
    if (pick === 'choir') return choir
    return part === 'chorus' || part === 'refrain' || settings.choir.verses ? choir : choir.slice(0, 1)
  }

  /** A line fitted to its bars: the lead's score, to its tune, and the words' stresses. */
  const fit = async (
    part: string,
    index: number,
    line: string,
    bpm = mood.character.tempo,
    explicit?: readonly Phrase[],
    voice?: Readonly<Record<string, number | string>>,
  ): Promise<Fitted & { hummed: boolean }> => {
    // a line with nothing a throat can sing is hummed: one "ooh" for every note of its tune
    let syllables = await countSyllables(line).catch(() => 0)
    let words = line
    let hummed = false
    if (syllables < 1) {
      syllables = notesOf(part, index, explicit)
      words = hum(syllables)
      hummed = true
    }
    // the words with their stress, for fitting them bar by bar
    const stressed: Syllables[] | undefined = hummed ? undefined : await stressedLine(line, syllables)
    const score = setLine({
      part,
      ...(explicit ? { phrases: explicit } : {}),
      line: index,
      lyrics: words,
      syllables,
      singer: singersOf(part, voice)[0]!.body,
      character: { ...mood.character, tempo: bpm },
      tune,
      rate,
      words: stressed,
    })
    return { score, words: stressed, hummed }
  }

  const sing = async (
    part: string,
    index: number,
    line: string,
    fitted: Promise<Fitted & { hummed: boolean }>,
    written?: Written,
    bpm = mood.character.tempo,
    key = lineKey(part, index, line),
    explicit?: readonly Phrase[],
    voice?: Readonly<Record<string, number | string>>,
    regionIndex?: number,
  ): Promise<Omit<SungLine, 'at'>> => {
    const { score: tuned, hummed } = await fitted
    const voices = singersOf(part, voice)
    const effectiveHumanness = typeof voice?.humanness === 'number' ? humanness * voice.humanness : humanness
    const breathPreset = typeof voice?.breath === 'string' ? voice.breath : undefined
    // written over its guide, the lead sings the writer's pitches to the tune's rhythm
    const led = written ? sungAs(tuned, written.degrees, keyFor(voices[0]!.body, mood.character.mode)) : tuned
    // written over its guide, the choir hears the guide's chords too, and leans on them
    const chords = written
      ? chordsHeard(written.guide, modes[mood.character.mode], { offset: written.offset, bpm, lineBpm: led.bpm })
      : undefined
    const scores = choirOf(led, voices, key, chords)
    const takes = voices.map((singer, v) => {
      const score = scores[v]!
      const take = {
        ...humanize(score, `${iteration}:${key}:${v}`, effectiveHumanness, rate),
        // each singer breathes through a throat of their own, optionally shaped by block `breath`
        ...throatForBreath(singer.throat, breathPreset),
      }
      // a line that would come too quickly is never sung: the iteration fails, and is made again
      keepsPace(take, rate, `"${line}" in iteration ${iteration}, voice ${v}`)
      return { voice: singer, score, take }
    })

    const sung = (
      await Promise.all(
        takes.map(async ({ voice: singer, take }, v) => {
          try {
            return {
              file: await record(take, singer.body),
              gain: singer.gain,
              voice: v,
              take: throatScore(take),
            }
          } catch (error) {
            // a throat that cannot sing this line falls silent for it; the others go on
            console.warn(
              `a ${singer.body} voice could not sing "${line}": ${error}`,
            )
            return undefined
          }
        }),
      )
    ).filter((s) => s !== undefined)

    if (hummed) console.warn(`hummed a line with no words to sing: "${line}"`)

    // the line keeps its place in time even if nobody could sing it
    const { score, take } = takes[0]!
    const [lastPitch, lastBeats] = score.notes.at(-1) ?? [0, 0]
    const rest = lastPitch === 0 ? (lastBeats * 60) / score.bpm : 0
    const file = sung.length > 0 ? await blend(sung).catch(() => '') : ''
    const recordings = [...new Set([...sung.map((s) => s.file), file])].filter(
      Boolean,
    )
    // a whole choir is fuller than one voice, but not louder than a throat can bear
    const total = sung.reduce((sum, { gain }) => sum + gain, 0)
    const headroom = Math.min(1, fullness / Math.max(total, 1))
    const own = sung.map((s) => ({ ...s, gain: Math.round(s.gain * headroom * 1000) / 1000 }))
    return {
      part,
      ...(regionIndex !== undefined ? { region: regionIndex } : {}),
      words: 'written',
      index,
      lyrics: line,
      file,
      voices: own,
      recordings,
      seconds: scoreSeconds(score),
      enters: take.t0,
      voiced: scoreSeconds(score) - rest,
      ...grownOf(part, index, score, explicit),
      quickest: Math.round(quickest(take) * 1000) / 1000,
      ...(written ? { written } : {}),
    }
  }

  /** Speaks one line through Chimera's speaking throat, returning exact audio duration and speech spec for Receivers. */
  const speakLine = async (
    part: string,
    index: number,
    line: string,
    parameters?: Readonly<Record<string, number>>,
    voice?: Readonly<Record<string, number | string>>,
    regionIndex?: number,
  ): Promise<Omit<SungLine, 'at'>> => {
    const [lead] = choir
    const breathPreset = typeof voice?.breath === 'string' ? voice.breath : undefined
    const throat = throatForBreath(lead!.throat, breathPreset)
    const speech: SpeechSpec = {
      text: line,
      body: lead!.body,
      rate: parameters?.rate ?? 0.92,
      ...(throat?.pressure !== undefined ? { pressure: throat.pressure } : {}),
      ...(throat?.tension !== undefined ? { tension: throat.tension } : {}),
      ...(throat?.breathiness !== undefined ? { breathiness: throat.breathiness } : {}),
    }
    const said = await speakInto(speech)
    const pause = 0.35
    return {
      part,
      ...(regionIndex !== undefined ? { region: regionIndex } : {}),
      words: 'spoken',
      index,
      lyrics: line,
      file: said.file,
      voices: [],
      speech,
      recordings: [said.file],
      seconds: said.seconds + pause,
      enters: 0.05,
      voiced: said.seconds,
    }
  }

  /** Every line fitted to its bars first, by its key: the same line in the same place is fitted once. */
  const fits = new Map<string, Promise<Fitted & { hummed: boolean }>>()
  const linesOf = (content: string) =>
    content
      .split('\n')
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.trim())
  const regionBpmOf = (tempo?: number | null) => (typeof tempo === 'number' ? tempo : mood.character.tempo)
  const regionScope = (
    part: string,
    index: number,
    parameters?: Readonly<Record<string, number>>,
    tempo?: number | null,
    explicit?: 'full' | 'half',
    voice?: Readonly<Record<string, number | string>>,
  ) => {
    const resolvedEnding = endingFor(part, index, parts.length, explicit)
    const defaultEnding = endingFor(part, index, parts.length)
    return scopeOf(
      parameters,
      tempo !== undefined && tempo !== mood.character.tempo ? tempo : undefined,
      resolvedEnding !== defaultEnding ? resolvedEnding : undefined,
      voice,
    )
  }

  for (const [s, one] of parts.entries()) {
    if (wordModeOf(one) !== 'written') continue
    const { type: part, content, parameters, tempo, ending, voice } = one
    const bpm = regionBpmOf(tempo)
    const scope = regionScope(part, s, parameters, tempo, ending, voice)
    const explicit = phrasesFor(one, s)
    for (const { line, index } of linesOf(content)) {
      const key = lineKey(part, index, line, scope)
      if (fits.has(key)) continue
      const fitting = fit(part, index, line, bpm, explicit, voice)
      // a line that cannot be fitted fails the iteration when it is sung, not before
      fitting.catch(() => {})
      fits.set(key, fitting)
    }
  }
  // with two voices, the lead's melody is written over each section's guide before anyone sings
  let written = new Map<string, Written>()
  if (twoVoices) {
    const counted = new Map<string, number>()
    const unwritten: Unwritten[] = []
    for (const [s, one] of parts.entries()) {
      const { type: part, content, parameters, ending, tempo, voice } = one
      const n = counted.get(part) ?? 0
      counted.set(part, n + 1)
      if (wordModeOf(one) !== 'written') continue
      const bpm = regionBpmOf(tempo)
      const scope = regionScope(part, s, parameters, tempo, ending, voice)
      const progSetting = settings.progression[part as 'verse' | 'chorus' | 'bridge'] ?? settings.progression.verse
      const melSetting = settings.melody[part as 'verse' | 'chorus' | 'bridge'] ?? settings.melody.verse
      unwritten.push({
        name: `${part}:${n}`,
        // a chorus or refrain comes home, and so does the iteration, unless the Arrangement says otherwise
        ending: endingFor(part, s, parts.length, ending),
        ...(bpm !== mood.character.tempo ? { bpm } : {}),
        // which chords: the part's progression, coming home to a favourite if a Perspective says so
        progression: await progressionOf(progSetting, { part, place: n, song: song.number }),
        // how high and how far the part's melody goes: Tides and Perspectives, with any explicit per-instance override layered on top
        melody: melodyFor(melSetting, parameters),
        lines: await Promise.all(
          linesOf(content).map(async ({ line, index }) => {
            const key = lineKey(part, index, line, scope)
            return { key, index, fitted: await fits.get(key)! }
          }),
        ),
      })
    }
    const { MELODY_SPRINKLE, MELODY_GUIDE } = getEnv()
    const [lead] = choir
    written = writeSections({
      sections: unwritten,
      iteration,
      mode: mood.character.mode,
      bpm: mood.character.tempo,
      lead: { key: keyFor(lead!.body, mood.character.mode), body: lead!.body },
      before: new Map(before.flatMap((line) => (line.written ? [[`${line.written.section}:${line.index}`, line.written] as const] : []))),
      sprinkle: MELODY_SPRINKLE,
      pull: MELODY_GUIDE,
    })
  }

  for (const [s, one] of parts.entries()) {
    const { type: part, content, index: section, parameters, tempo, seconds, ending, voice } = one
    const mode = wordModeOf(one)
    if (mode === 'silent') {
      const dur = seconds ?? one.part?.durationSeconds?.(tempo ?? mood.character.tempo, parameters ?? {}) ?? parameters?.seconds ?? 4
      order.push(
        Promise.resolve({
          part,
          region: s,
          words: 'silent',
          index: 0,
          lyrics: '',
          file: '',
          voices: [],
          recordings: [],
          seconds: dur,
          enters: 0,
          voiced: 0,
          unheard: true,
        }),
      )
      continue
    }
    if (mode === 'spoken') {
      const spokenLines = linesOf(content)
      if (spokenLines.length === 0) {
        order.push(
          Promise.resolve({
            part,
            region: s,
            words: 'spoken',
            index: 0,
            lyrics: '',
            file: '',
            voices: [],
            recordings: [],
            seconds: seconds ?? 2,
            enters: 0,
            voiced: 0,
            unheard: true,
          }),
        )
        continue
      }
      for (const { line, index } of spokenLines) {
        order.push(speakLine(part, index, line, parameters, voice, s))
      }
      continue
    }
    if (part === 'bridge') {
      const from = parts[section - 1]?.type === 'chorus' ? 'chorus' : 'verse'
      const to = parts[section + 1]?.type === 'chorus' ? 'chorus' : 'verse'
      const key = lineKey('bridge', section, '')
      if (!takes.has(key)) takes.set(key, bridge(section, from, to, tempo, seconds, s))
      order.push(takes.get(key)!)
      continue
    }
    if (mode === 'none') {
      // wordless musical section (e.g. `interlude`): fixed bars or free-time seconds; guide & bed carry the sound
      const bpm = regionBpmOf(tempo)
      const dur = seconds ?? one.part?.durationSeconds?.(tempo ?? bpm, parameters ?? {}) ?? ((parameters?.bars ?? 8) * 4 * 60) / bpm
      order.push(
        Promise.resolve({
          part,
          region: s,
          words: 'none',
          index: 0,
          lyrics: '',
          file: '',
          voices: [],
          recordings: [],
          seconds: dur,
          enters: 0,
          voiced: 0,
          unheard: true,
        }),
      )
      continue
    }
    const bpm = regionBpmOf(tempo)
    const scope = regionScope(part, s, parameters, tempo, ending, voice)
    const explicit = phrasesFor(one, s)
    const writtenLines = linesOf(content)
    if (writtenLines.length === 0) {
      // keep 1-to-1 alignment with regions when an extra written part has no lines yet (e.g. iteration 1)
      order.push(
        Promise.resolve({
          part,
          region: s,
          words: 'written',
          index: 0,
          lyrics: '',
          file: '',
          voices: [],
          recordings: [],
          seconds: seconds ?? 2,
          enters: 0,
          voiced: 0,
          unheard: true,
        }),
      )
      continue
    }
    for (const { line, index } of writtenLines) {
      const key = lineKey(part, index, line, scope)
      if (!takes.has(key)) takes.set(key, sing(part, index, line, fits.get(key)!, written.get(key), bpm, key, explicit, voice, s))
      order.push(takes.get(key)!.then((sungLine) => ({ ...sungLine, region: s })))
    }
  }

  let at = 0
  return (await Promise.all(order)).map((line) => {
    const placed = { ...line, at }
    at += line.seconds
    return placed
  })
}
