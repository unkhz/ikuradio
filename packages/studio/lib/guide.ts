// The guide hums: for every bed the Music grows, the lead hums its melody
// slowly, the same tempo with fewer notes, for the Music to follow. A guide
// for a verse or the chorus is that part's lines slowed to their skeleton.
// A guide for a bridge is the bridge's own journey, from the last notes of
// the part it leaves to the first note of the part it leads to. Every guide
// lasts as long as its section and the tail after it, holding its last
// note, so the Music has a voice to follow while it fades. A guide is never
// heard by anyone: it is what the Music listened to, and the Archive keeps
// it as that, with its score.

import { holdLast, phraseOf, setBridge, setGuide, type Phrase, type Score } from 'melody'
import { sections, tail, type Kind } from 'music'
import { record, type Take } from 'vocals'
import type { Iteration } from './compose.js'
import { hum, type SungLine } from './perform.js'

export type Guide = {
  /** The kind of bed it guided. */
  kind: Kind
  part: 'verse' | 'chorus' | 'bridge'
  /** The section it was hummed for, from the start of the iteration. */
  at: number
  /** How long the section lasts; the guide goes on through the tail after it. */
  seconds: number
  file: string
  /** What the lead hummed: the guide's notes, in MIDI and beats, at its tempo. */
  score: Pick<Score, 'bpm' | 'notes'>
}

/**
 * Hums a guide for the first section of each kind of bed in an iteration:
 * the sections the Music grows its beds from. A guide the lead cannot hum
 * is left out, and the Music listens to the sung voice instead.
 */
export async function humGuides(
  { mood, choir, sung: tune }: Iteration,
  lines: SungLine[],
): Promise<Guide[]> {
  const [lead] = choir
  const all = sections(lines)
  const first = all.filter((s, i) => all.findIndex((t) => t.kind === s.kind) === i)
  const beatsOf = (seconds: number) => (seconds * mood.character.tempo) / 60
  const voice = { singer: lead.body, character: mood.character, harmony: lead.harmony }
  const guides = await Promise.all(
    first.map(async (section): Promise<Guide | undefined> => {
      const score =
        section.part === 'bridge'
          ? // a bridge's guide is its journey, from the part it leaves to the one it leads to
            setBridge({
              from: section.from ?? 'verse',
              to: section.to ?? 'chorus',
              lyrics: hum,
              tune,
              beats: beatsOf(section.seconds),
              ...voice,
            })
          : setGuide({
              lines: section.lines.map((line) => ({
                phrase: phraseOf(tune, line.part as 'verse' | 'chorus', line.index) as Phrase,
                beats: beatsOf(line.seconds),
              })),
              lyrics: hum,
              ...voice,
            })
      const held = holdLast(score, beatsOf(tail))
      try {
        // steady, without a singer's wavering: it is a map, not a performance
        const take: Take = { ...held, t0: 0.05, vibrato: 0, ...lead.throat }
        const file = await record(take, lead.body)
        return {
          kind: section.kind,
          part: section.part,
          at: section.at,
          seconds: section.seconds,
          file,
          score: { bpm: held.bpm, notes: held.notes },
        }
      } catch (error) {
        console.warn(`the lead could not hum the guide for the ${section.kind}: ${error}`)
        return undefined
      }
    }),
  )
  return guides.filter((guide) => guide !== undefined)
}
