// A performance: every line of an iteration set to its tune, in the mode
// and tempo of the Mood, sung by the choir, and laid out in time.
//
// The lead sings every line. The rest of the choir joins in the chorus.
// Every voice sings its own take, a little wrong in its own way, and the
// takes are blended into one recording per line.

import { arrange } from 'song'
import { scoreSeconds, setLine } from 'melody'
import { blend, countSyllables, humanize, record } from 'vocals'
import type { Iteration } from './compose.js'

export type SungLine = {
  part: 'verse' | 'chorus'
  /** Which line of its part, from 0. */
  index: number
  lyrics: string
  /** The recording, where the UI can fetch it. Empty if no voice could sing the line. */
  file: string
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
}

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
}: Iteration): Promise<SungLine[]> {
  const takes = new Map<string, Promise<Omit<SungLine, 'at'>>>()
  const order: Promise<Omit<SungLine, 'at'>>[] = []

  /** How many notes a line's tune has, before any words bend it. */
  const notesOf = (part: SungLine['part'], index: number) => {
    const phrases = part === 'chorus' ? tune.chorus : tune.verse
    return phrases[index % phrases.length].notes.length
  }

  const sing = async (
    part: SungLine['part'],
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

    const voices = part === 'chorus' ? choir : choir.slice(0, 1)
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
      const take = humanize(
        score,
        `${iteration}:${lineKey(part, index, line)}:${v}`,
      )
      return { voice, score, take }
    })

    const sung = (
      await Promise.all(
        takes.map(async ({ voice, take }) => {
          try {
            return { file: await record(take, voice.body), gain: voice.gain }
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
    return {
      part,
      index,
      lyrics: line,
      file,
      recordings,
      seconds: scoreSeconds(score),
      enters: take.t0,
      voiced: scoreSeconds(score) - rest,
    }
  }

  for (const { type: part, content } of arrange(lyrics)) {
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
