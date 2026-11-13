// A performance: every line of an iteration set to its tune, in the mode
// and tempo of the Mood, sung by the choir, and laid out in time.
//
// The lead sings every line. The rest of the choir joins in the chorus.
// Every voice sings its own take, a little wrong in its own way, and the
// takes are blended into one recording per line.

import { arrange } from 'song'
import { scoreSeconds, setBridge, setLine, wrongness } from 'melody'
import { blend, countSyllables, fullness, humanize, record, throatScore, type Take } from 'vocals'
import type { Iteration } from './compose.js'

export type SungLine = {
  part: 'verse' | 'chorus' | 'bridge'
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
}

/** How often a bridge is hummed aloud, rather than only played, unless a Perspective says otherwise. */
export const humming = 0.5

/** How loud a bridge's hum is, beside a sung line. */
const humGain = 0.7

/** A hum, one "ooh" for each note: what a singer sings when there are no words. */
export const hum = (notes: number) =>
  Array.from({ length: notes }, () => 'ooh').join(' ')

/** Where a line stands in the song and what it says. The same line in the same place is sung the same. */
export const lineKey = (part: string, index: number, lyrics: string) =>
  `${part}:${index}:${lyrics}`

export async function perform({
  iteration,
  lyrics,
  mood,
  choir,
  sung: tune,
  song,
  settings,
}: Iteration): Promise<SungLine[]> {
  // the Song's Perspectives, as its hooks here follow them
  const humanness = settings.humanness.scale
  const bridging = settings['bridge-singers']

  const takes = new Map<string, Promise<Omit<SungLine, 'at'>>>()
  const order: Promise<Omit<SungLine, 'at'>>[] = []

  /** How many notes a line's tune has, before any words bend it. */
  const notesOf = (part: SungLine['part'], index: number) => {
    const phrases = part === 'chorus' ? tune.chorus : tune.verse
    return phrases[index % phrases.length].notes.length
  }

  /**
   * A bridge: the lead hums the last line of the part that has just ended,
   * and the Music plays on. The hum is always recorded, because the Music
   * grows the bridge's bed from it, but only sometimes heard.
   */
  const bridge = async (
    section: number,
    from: 'verse' | 'chorus',
    to: 'verse' | 'chorus',
  ): Promise<Omit<SungLine, 'at'>> => {
    const [lead] = choir
    // the lead hums, or, in a Song heard that way, the whole choir in its harmonies
    const hummers = bridging.choir ? choir : [lead]
    // the hum walks from where the last part ended to where the next begins
    const hums = hummers.map((voice, v) => {
      const score = setBridge({
        from,
        to,
        lyrics: hum,
        singer: voice.body,
        character: mood.character,
        harmony: voice.harmony,
        tune,
        song: song.number,
      })
      const take = {
        // the lead's take is named as it always was
        ...humanize(score, v === 0 ? `${iteration}:bridge:${section}` : `${iteration}:bridge:${section}:${v}`, humanness),
        ...voice.throat,
      }
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

  const sing = async (
    part: 'verse' | 'chorus',
    index: number,
    line: string,
  ): Promise<Omit<SungLine, 'at'>> => {
    // a line with nothing a throat can sing is hummed: one "ooh" for every note of its tune
    let syllables = await countSyllables(line).catch(() => 0)
    let words = line
    let hummed = false
    if (syllables < 1) {
      syllables = notesOf(part, index)
      words = hum(syllables)
      hummed = true
    }

    // the lead sings every line; the others the chorus, or, in a Song heard that way, the verses too
    const voices = part === 'chorus' || settings.choir.verses ? choir : choir.slice(0, 1)
    const takes = voices.map((voice, v) => {
      const score = setLine({
        part,
        line: index,
        lyrics: words,
        syllables,
        singer: voice.body,
        character: mood.character,
        harmony: voice.harmony,
        tune,
      })
      const take = {
        ...humanize(score, `${iteration}:${lineKey(part, index, line)}:${v}`, humanness),
        // each singer breathes through a throat of their own
        ...voice.throat,
      }
      return { voice, score, take }
    })

    const sung = (
      await Promise.all(
        takes.map(async ({ voice, take }, v) => {
          try {
            return {
              file: await record(take, voice.body),
              gain: voice.gain,
              voice: v,
              take: throatScore(take),
            }
          } catch (error) {
            // a throat that cannot sing this line falls silent for it; the others go on
            console.warn(
              `a ${voice.body} voice could not sing "${line}": ${error}`,
            )
            return undefined
          }
        }),
      )
    ).filter((s) => s !== undefined)

    if (hummed) console.warn(`hummed a line with no words to sing: "${line}"`)

    // the line keeps its place in time even if nobody could sing it
    const { score, take } = takes[0]
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
      index,
      lyrics: line,
      file,
      voices: own,
      recordings,
      seconds: scoreSeconds(score),
      enters: take.t0,
      voiced: scoreSeconds(score) - rest,
    }
  }

  const parts = arrange(lyrics)
  for (const { type: part, content, index: section } of parts) {
    if (part === 'bridge') {
      const from = parts[section - 1]?.type === 'chorus' ? 'chorus' : 'verse'
      const to = parts[section + 1]?.type === 'chorus' ? 'chorus' : 'verse'
      const key = lineKey('bridge', section, '')
      if (!takes.has(key)) takes.set(key, bridge(section, from, to))
      order.push(takes.get(key)!)
      continue
    }
    for (const [index, line] of content.split('\n').entries()) {
      if (!line.trim()) continue
      const key = lineKey(part, index, line)
      if (!takes.has(key)) takes.set(key, sing(part, index, line))
      order.push(takes.get(key)!)
    }
  }

  let at = 0
  return (await Promise.all(order)).map((line) => {
    const placed = { ...line, at }
    at += line.seconds
    return placed
  })
}
