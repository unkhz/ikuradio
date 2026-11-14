// How a part's lines are set on the page. A line that fits the page's width
// is a line of its own, as a verse is written. A line too long for it wraps,
// and its last row is left short; rather than leave a word or two alone
// there, the next line runs on after it, on the same row, as a quoted poem
// runs its lines together. Once a line fits on a row again, the rows break
// where the lines do.
//
// Only the setting changes: every word of every line is shown, however long.

/** One line of a part, measured: how wide its first word is, and how it wraps. */
export type Measured = {
  /** the width of the line's first word, which cannot be broken across rows */
  firstWord: number
  /**
   * How many rows the line takes when its first row is `first` wide and the
   * rest `width`, and how wide its last row is.
   */
  rows(first: number, width: number): { count: number; last: number }
}

/**
 * Whether each line ends its row (true) or the next line runs on after it
 * (false), when the page is `width` wide and a line running on is set `gap`
 * after the one before it. The last line always ends its row.
 */
export function flow(lines: readonly Measured[], width: number, gap: number): boolean[] {
  const breaks: boolean[] = []
  // how far along its row the page has written
  let x = 0
  for (const line of lines) {
    let first = width
    // running on, where the line's first word fits after the gap; where it
    // does not, the row ends at the gap and the line begins one of its own
    if (x > 0 && x + gap + line.firstWord <= width) first = width - x - gap
    const { count, last } = line.rows(first, width)
    if (count <= 1) {
      breaks.push(true)
      x = 0
    } else {
      breaks.push(false)
      x = last
    }
  }
  if (breaks.length) breaks[breaks.length - 1] = true
  return breaks
}
