// Words never come in the length a tune was written for. A phrase must make
// room for every syllable it is handed, and give back the room it does not
// need, without forgetting its shape.
//
// Fitting is deterministic. The same words always meet the same tune in the
// same way, so a line that returns sounds like itself.

/** One note of a phrase: a scale degree, and its length in beats. */
export type Note = readonly [degree: number, beats: number]

export type Phrase = {
  notes: readonly Note[]
  /** Silence after the last note, in beats. Breath before the next line. */
  rest: number
}

/** Below this length a note is not split any further, unless a tempo and a rate say otherwise; the phrase slows down instead. */
const shortest = 0.25

/**
 * The grid a voice sings on: sixteenths, and two syllables at least `k` of
 * them apart, `k = ceil(bpm / (15 × rate))`, so that no syllable comes
 * sooner than 1 / `rate` seconds after the one before. A slow song may sing
 * sixteenths; a fast one, eighths.
 */
export function spacing(bpm: number, rate: number): number {
  return Math.max(1, Math.ceil(bpm / (15 * rate) - 1e-9))
}

/** The shortest note the grid allows at a tempo and rate, in beats. */
export const shortestBeats = (bpm: number, rate: number) => spacing(bpm, rate) / 4

/**
 * Bends a phrase to carry exactly `syllables` sung notes.
 *
 * Too many notes: the shortest inner note is folded into the note before it.
 * Too few: the longest note before the cadence is split in two, repeated in
 * place, the way a chant repeats a pitch to make room for more words. When
 * the notes are already as short as `least` allows (the grid's, at the
 * line's tempo and rate), the whole phrase is stretched to twice its
 * length, so that a line which keeps growing (the spelled-out iteration
 * number does) is sung slower and longer, never gabbled. A phrase whose
 * own notes are shorter than `least` is stretched the same way.
 *
 * The first note and the last note, the departure and the cadence, are never
 * removed and never split.
 */
export function fitPhrase(phrase: Phrase, syllables: number, least = shortest): Phrase {
  if (!Number.isInteger(syllables) || syllables < 1) {
    throw new Error(`a phrase cannot carry ${syllables} syllables`)
  }
  let notes: Note[] = [...phrase.notes]
  let rest = phrase.rest

  while (notes.length > syllables) {
    notes = foldShortest(notes)
  }

  const slower = () => {
    notes = notes.map(([degree, beats]) => [degree, beats * 2])
    rest *= 2
  }
  while (notes.length < syllables) {
    const split = splitLongest(notes, least)
    if (split) notes = split
    else slower()
  }
  // a sung note quicker than the grid allows, an ornament's, is slowed too
  while (notes.slice(0, -1).some(([, beats]) => beats < least - 1e-9)) slower()

  return { notes, rest }
}

function foldShortest(notes: Note[]): Note[] {
  if (notes.length === 2) {
    return [[notes[0][0], notes[0][1] + notes[1][1]]]
  }
  let pick = 1
  for (let i = 2; i < notes.length - 1; i++) {
    if (notes[i][1] < notes[pick][1]) pick = i
  }
  const folded = [...notes]
  const [, beats] = folded.splice(pick, 1)[0]
  const [degree, before] = folded[pick - 1]
  folded[pick - 1] = [degree, before + beats]
  return folded
}

function splitLongest(notes: Note[], least: number): Note[] | undefined {
  // a lone note is its own cadence, and is allowed to split
  const last = notes.length === 1 ? 1 : notes.length - 1
  let pick = -1
  for (let i = 0; i < last; i++) {
    if (
      notes[i][1] >= least * 2 - 1e-9 &&
      (pick < 0 || notes[i][1] > notes[pick][1])
    ) {
      pick = i
    }
  }
  if (pick < 0) return undefined
  const [degree, beats] = notes[pick]
  const split = [...notes]
  split.splice(pick, 1, [degree, beats / 2], [degree, beats / 2])
  return split
}

/** One word as the bar fit sees it: its syllables' stress (0 none, 1 main, 2 lesser), and whether a comma follows it. */
export type Syllables = { stresses: readonly number[]; comma?: boolean }

/** How strong a sixteenth of a bar is: the first beat, the third, the second and fourth, the eighths between, the rest. */
export const strength = (sixteenth: number) => {
  const at = ((sixteenth % 16) + 16) % 16
  return at === 0 ? 3 : at === 8 ? 2 : at % 4 === 0 ? 1.5 : at % 2 === 0 ? 0.5 : 0
}

/**
 * What placing a syllable away from where the tune has a note costs: more
 * than stress can ever gain, so the tune is kept wherever the words allow,
 * and stress decides where the syllables it has no notes for go, and which
 * of its notes give way.
 */
const offTheTune = 5
/** How much a stressed syllable gains for each degree of a beat's strength. */
const leaning = 0.6
/** What an unstressed syllable on the first beat of a bar costs. */
const weakDownbeat = 1
/** What a bar line costs inside a word, more than anything else, so it happens only where a word cannot fit in one bar; and between words where there is no comma. */
const midWord = 50
const noComma = 0.5

/**
 * Fits words to a phrase bar by bar, on the grid of sixteenths: every
 * syllable starts on a sixteenth, at least `k` of them after the one before,
 * the first where the phrase begins and the last on its cadence, which is
 * never split. Of the ways to place them, the one chosen keeps closest to
 * where the tune has notes, puts the stressed syllables on the strong beats
 * and the unstressed ones off the first beat of a bar, and lets the bar
 * lines fall between words, at a comma where it can. Each syllable is sung
 * at the tune's pitch where it starts, until the next one starts. Undefined
 * if the words do not fit the phrase at this spacing: then the line needs
 * more time than its phrase has.
 */
export function fitBars(phrase: Phrase, words: readonly Syllables[], k: number): Phrase | undefined {
  const syllables = words.flatMap((word, w) =>
    word.stresses.map((stress, i) => ({
      weight: stress === 1 ? 1 : stress === 2 ? 0.5 : 0,
      begins: i === 0,
      afterComma: i === 0 && w > 0 && Boolean(words[w - 1]!.comma),
    })),
  )
  const count = syllables.length
  if (count < 2 || phrase.notes.length < 2) return count === phrase.notes.length ? phrase : undefined
  // the tune on the grid: where each of its notes starts, in sixteenths
  const starts: number[] = []
  let at = 0
  for (const [, beats] of phrase.notes) {
    starts.push(Math.round(at * 4))
    at += beats
  }
  const cadence = starts.at(-1)!
  const onTune = new Set(starts)
  const pitchAt = (p: number) => phrase.notes[starts.findLastIndex((start) => start <= p)]![0]
  if ((count - 1) * k > cadence) return undefined

  const cost = (s: number, p: number) => {
    const { weight } = syllables[s]!
    return (onTune.has(p) ? 0 : offTheTune) - leaning * weight * strength(p) + (weight === 0 && p % 16 === 0 ? weakDownbeat : 0)
  }
  const crossing = (s: number, from: number, to: number) => {
    if (Math.floor(from / 16) === Math.floor(to / 16) && to % 16 !== 0) return 0
    const { begins, afterComma } = syllables[s]!
    return !begins ? midWord : afterComma ? 0 : noComma
  }
  // the cheapest placement, syllable by syllable: best[s][p] for syllable s starting at sixteenth p
  const best: { cost: number; from: number }[][] = [[]]
  best[0]![0] = { cost: cost(0, 0), from: -1 }
  for (let s = 1; s < count; s++) {
    const row: { cost: number; from: number }[] = []
    const last = s === count - 1
    const lowest = s * k
    const highest = last ? cadence : cadence - k
    for (let p = lowest; p <= highest; p++) {
      if (last && p !== cadence) continue
      let cheapest = { cost: Infinity, from: -1 }
      for (let q = (s - 1) * k; q <= p - k; q++) {
        const before = best[s - 1]![q]
        if (!before) continue
        const total = before.cost + crossing(s, q, p)
        if (total < cheapest.cost) cheapest = { cost: total, from: q }
      }
      if (cheapest.from >= 0) row[p] = { cost: cheapest.cost + cost(s, p), from: cheapest.from }
    }
    best.push(row)
  }
  if (!best[count - 1]![cadence]) return undefined
  const placed: number[] = []
  for (let s = count - 1, p = cadence; s >= 0; p = best[s]![p]!.from, s--) placed.unshift(p)
  const notes: Note[] = placed.map((p, s) =>
    s === count - 1 ? [phrase.notes.at(-1)![0], phrase.notes.at(-1)![1]] : [pitchAt(p), (placed[s + 1]! - p) / 4],
  )
  return { notes, rest: phrase.rest }
}

