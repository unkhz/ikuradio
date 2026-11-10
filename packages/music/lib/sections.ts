// Sections: an iteration heard as the parts it is built of. A verse of four
// lines is one section, and so is a chorus. A section begins where its first
// line begins and lasts until the next section begins, rest included.

export type Line = {
  part: 'verse' | 'chorus'
  /** Which line of its part, from 0. */
  index: number
  /** When the line begins, in seconds from the start of the iteration. */
  at: number
  /** How long the line lasts, rest included. */
  seconds: number
  /** The recording of the line, or empty if nobody could sing it. */
  file: string
}

export type Section<L extends Line = Line> = {
  part: Line['part']
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
      found.push({ part: line.part, at: line.at, seconds: 0, lines: [line] })
    }
  }
  for (const section of found) {
    const last = section.lines.at(-1)!
    section.seconds = last.at + last.seconds - section.at
  }
  return found
}
