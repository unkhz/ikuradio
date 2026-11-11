// Sections: an iteration heard as the parts it is built of. A verse of four
// lines is one section, and so is a chorus. A section begins where its first
// line begins and lasts until the next section begins, rest included.

export type Line = {
  part: 'verse' | 'chorus' | 'bridge'
  /** Which line of its part, from 0. */
  index: number
  /** When the line begins, in seconds from the start of the iteration. */
  at: number
  /** How long the line lasts, rest included. */
  seconds: number
  /** The recording of the line, or empty if nobody could sing it. */
  file: string
}

/**
 * What kind of bed lies under a section: its part, or, for a bridge, which
 * part it leaves and which it leads to, since a bridge from a verse into
 * the chorus is a different journey from one back out of it.
 */
export type Kind = 'verse' | 'chorus' | `bridge:${'verse' | 'chorus'}>${'verse' | 'chorus'}`

export type Section<L extends Line = Line> = {
  part: Line['part']
  kind: Kind
  /** For a bridge: the part it leaves, and the part it leads to. */
  from?: 'verse' | 'chorus'
  to?: 'verse' | 'chorus'
  at: number
  seconds: number
  lines: L[]
}

/** The sections of an iteration, in the order they are sung. */
export function sections<L extends Line>(lines: L[]): Section<L>[] {
  const found: Section<L>[] = []
  for (const line of lines) {
    const current = found.at(-1)
    if (current && current.part === line.part && line.index > 0) {
      current.lines.push(line)
    } else {
      found.push({
        part: line.part,
        kind: line.part === 'bridge' ? 'bridge:verse>chorus' : line.part,
        at: line.at,
        seconds: 0,
        lines: [line],
      })
    }
  }
  for (const [i, section] of found.entries()) {
    const last = section.lines.at(-1)!
    section.seconds = last.at + last.seconds - section.at
    if (section.part === 'bridge') {
      const from = found[i - 1]?.part === 'chorus' ? 'chorus' : 'verse'
      const to = found[i + 1]?.part === 'chorus' ? 'chorus' : 'verse'
      section.from = from
      section.to = to
      section.kind = `bridge:${from}>${to}`
    }
  }
  return found
}
