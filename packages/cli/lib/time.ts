// The terminal keeps time the way the page does. Scores arrive before their
// iteration begins; when one begins, or began a while ago for a listener who
// has just arrived, every voice and every bed is placed at its own moment
// from that beginning. A recording whose moment has passed is joined where
// it would be by now; one already over asks ffplay to begin past its end,
// and ffplay simply plays nothing.

export type Cue = { file: string; at: number; gain?: number }
export type Score = { iteration: string; lines: Cue[]; beds?: Cue[] }

/** When to start each recording, from now, in seconds, and from how far into it. */
export function placements(
  score: Score,
  since: number,
): { cue: Cue; after: number; from: number }[] {
  return [...score.lines, ...(score.beds ?? [])].map((cue) => {
    const after = cue.at - since
    return after >= 0
      ? { cue, after, from: 0 }
      : { cue, after: 0, from: -after }
  })
}
