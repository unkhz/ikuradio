// The page's measure of its lines, with Pretext: how wide the words are in
// the page's own letters, without asking the page to lay itself out.
// Built into one plain script beside the page (packages/ui/public/verses.js),
// to be committed with it, and read by the page as `verses`:
//
//   bun run verses

import { clearCache, layoutNextLineRange, prepareWithSegments, type LayoutCursor } from '@chenglou/pretext'
import { flow, type Measured } from './lib/flow.js'

function measure(text: string, font: string): Measured {
  const prepared = prepareWithSegments(text, font)
  let firstWord = 0
  for (let i = 0; i < prepared.segments.length && prepared.kinds[i] === 'text'; i++) firstWord += prepared.widths[i]!
  return {
    firstWord,
    rows(first, width) {
      let count = 0
      let last = 0
      let cursor: LayoutCursor | undefined
      for (let room = first; ; room = width) {
        const range = layoutNextLineRange(prepared, room, cursor)
        if (!range) break
        count++
        last = range.width
        cursor = range.end
      }
      return { count, last }
    },
  }
}

/** How wide a space is in `font`. */
function space(font: string): number {
  const prepared = prepareWithSegments('a a', font)
  const i = prepared.kinds.indexOf('space')
  return i < 0 ? 0 : prepared.widths[i]!
}

const verses = {
  /**
   * Whether each line ends its row, when set in `font` on a page `width`
   * wide, a line running on set a space and `extra` after the one before.
   */
  breaks: (lines: readonly string[], font: string, width: number, extra: number) =>
    flow(
      lines.map((text) => measure(text, font)),
      width,
      space(font) + extra,
    ),
  /** Forget every width measured: the page's letters have changed. */
  forget: clearCache,
}

Object.assign(globalThis, { verses })
