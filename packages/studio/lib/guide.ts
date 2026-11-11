// The guide hums: for each part of an iteration, the lead hums its melody
// slowly, the same tempo with fewer notes, for the Music to follow. A guide
// is never heard by anyone; it is what the Music listened to, and the Archive
// keeps it as that.

import { phraseOf, setGuide, type Phrase } from 'melody'
import { sections, type Part } from 'music'
import { record, type Take } from 'vocals'
import type { Iteration } from './compose.js'
import { hum, type SungLine } from './perform.js'

export type Guide = {
  part: Part
  /** The section it was hummed for, from the start of the iteration. */
  at: number
  seconds: number
  file: string
}

/**
 * Hums a guide for the first section of each part of an iteration, verse,
 * chorus and bridge: the sections the Music grows its beds from. A part the
 * lead cannot hum has no guide, and the Music listens to the sung voice.
 */
export async function humGuides(
  { mood, choir, sung: tune }: Iteration,
  lines: SungLine[],
): Promise<Guide[]> {
  const [lead] = choir
  const all = sections(lines)
  const first = all.filter((s, i) => all.findIndex((t) => t.part === s.part) === i)
  const beatsOf = (seconds: number) => (seconds * mood.character.tempo) / 60
  const guides = await Promise.all(
    first.map(async (section) => {
      const before = all[all.indexOf(section) - 1]?.part
      const phraseFor = (line: SungLine): Phrase =>
        line.part === 'bridge'
          ? // a bridge hums the last line of the part before it
            (before === 'chorus' ? tune.chorus : tune.verse).at(-1)!
          : phraseOf(tune, line.part, line.index)
      const score = setGuide({
        lines: section.lines.map((line) => ({ phrase: phraseFor(line), beats: beatsOf(line.seconds) })),
        lyrics: hum,
        singer: lead.body,
        character: mood.character,
        harmony: lead.harmony,
      })
      try {
        // steady, without a singer's wavering: it is a map, not a performance
        const take: Take = { ...score, t0: 0.05, vibrato: 0, ...lead.throat }
        const file = await record(take, lead.body)
        return { part: section.part, at: section.at, seconds: section.seconds, file }
      } catch (error) {
        console.warn(`the lead could not hum the ${section.part}'s guide: ${error}`)
        return undefined
      }
    }),
  )
  return guides.filter((guide) => guide !== undefined)
}
