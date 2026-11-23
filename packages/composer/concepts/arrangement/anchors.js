// What the Arrangement's page works out when a mouse puts something on the timeline (plan "Evolution of Song", step 13): the Anchor a moment is
// written as. A moment on the drawing is seconds; what the file holds is never seconds but an Anchor, the start or end of a region, which hearing
// of it, and so many seconds beyond. These functions are pure, from the timeline the server resolved and the names of the regions, so that they can
// be tested without a page. They name no part and no Track.

/** How many seconds an unsnapped drop is rounded to. */
const grain = 0.1

const round = (value, to = grain) => Math.round(value / to) * to
/** A number as it is written in a file: no trailing noise. */
const tidy = (value) => Number(value.toFixed(3))

/** How many times each name is heard. */
function heardCounts(names) {
  const counts = new Map()
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
  return counts
}

/** The index of a region by its name and which hearing of it, or nothing. */
function regionIndexOf(names, region, hearing = 1) {
  let seen = 0
  for (const [i, name] of names.entries()) if (name === region && ++seen === hearing) return i
  return undefined
}

/** A region as an anchor names it: its name, and which hearing of it where it is heard more than once. */
function regionRef(names, index) {
  const name = names[index]
  const heard = heardCounts(names).get(name)
  if (heard === 1) return { region: name }
  return { region: name, hearing: names.slice(0, index + 1).filter((other) => other === name).length }
}

/** A boundary between regions (0 before the first, n after the last), and the seconds beyond it, from an anchor; nothing if it names what is not there. */
function boundaryOf(names, anchor) {
  const plus = anchor.plus ?? 0
  if (anchor.region === undefined) return { boundary: anchor.edge === 'start' ? 0 : names.length, plus }
  const index = regionIndexOf(names, anchor.region, anchor.hearing)
  return index === undefined ? undefined : { boundary: anchor.edge === 'start' ? index : index + 1, plus }
}

/**
 * The anchor for a boundary and the seconds beyond it. A `from` is the start of the region that begins at the boundary (the end of the Song at
 * the last); a `to` is the end of the region that ends there (the start of the Song at the first); a `point`, for a tempo change or a turn, is the start of the region.
 */
function anchorFor(names, boundary, plus, side) {
  const n = names.length
  const extra = plus ? { plus: tidy(plus) } : {}
  if (side === 'to') return boundary > 0 ? { ...regionRef(names, boundary - 1), edge: 'end', ...extra } : { edge: 'start', ...extra }
  return boundary < n ? { ...regionRef(names, boundary), edge: 'start', ...extra } : { edge: 'end', ...extra }
}

/** An anchor in words, for what a drag will write: "verse-1 end + 2.0 s". */
function labelOf(anchor) {
  const where = anchor.region === undefined ? 'the Song' : `${anchor.region}${anchor.hearing ? ` (${anchor.hearing})` : ''}`
  const plus = anchor.plus ? ` ${anchor.plus > 0 ? '+' : '−'} ${Math.abs(anchor.plus).toFixed(1)} s` : ''
  return `${where} ${anchor.edge}${plus}`
}

/** The seconds each boundary is at: the start of each region, and the end of the Song. */
const boundariesOf = (timeline) => [...timeline.regions.map((region) => region.startSeconds), timeline.seconds]

/** The bars of the stretches that have a tempo, as moments inside a region: where each is, the boundary it is after and the seconds beyond it. */
function barsOf(timeline) {
  const found = []
  for (const region of timeline.regions) {
    if (region.tempo === null) continue
    const bar = (timeline.beatsPerBar * 60) / region.tempo
    const segment = timeline.segments.find((one) => region.startSeconds >= one.from - 1e-9 && region.startSeconds < one.to - 1e-9)
    if (!segment) continue
    // the bars count from the start of the stretch, and the first one in a region is the first after its start
    let at = segment.from + Math.ceil((region.startSeconds - segment.from) / bar - 1e-9) * bar
    for (; at < region.startSeconds + region.seconds - 1e-9; at += bar) if (at > region.startSeconds + 1e-9) found.push({ seconds: at, boundary: region.index, plus: at - region.startSeconds })
  }
  return found
}

/**
 * The anchor a moment is written as, and the moment it then is. With `snap`, to the nearest region edge or bar within `radius` seconds; otherwise, or where
 * nothing is near, the nearest region edge plus so many seconds, rounded to a tenth. A stretch in free time has no bars, only its edges. `side` is as `anchorFor`'s.
 */
function anchorAt(timeline, names, seconds, { side = 'from', snap = true, radius = 0 } = {}) {
  const bounds = boundariesOf(timeline)
  const t = Math.min(Math.max(seconds, 0), timeline.seconds + 1e6)
  if (snap) {
    const near = [...bounds.map((at, boundary) => ({ seconds: at, boundary, plus: 0, kind: 'edge' })), ...barsOf(timeline).map((bar) => ({ ...bar, kind: 'bar' }))]
      .filter((candidate) => Math.abs(candidate.seconds - t) <= radius)
      .sort((a, b) => Math.abs(a.seconds - t) - Math.abs(b.seconds - t) || (a.kind === 'edge' ? -1 : 1))[0]
    if (near) {
      const anchor = anchorFor(names, near.boundary, near.kind === 'bar' ? tidy(near.plus) : 0, side === 'to' && near.kind === 'bar' ? 'from' : side)
      // the moment the anchor resolves to: a bar's seconds are written to a thousandth
      return { anchor, seconds: bounds[near.boundary] + (near.kind === 'bar' ? tidy(near.plus) : 0), label: labelOf(anchor), snapped: near.kind }
    }
  }
  let boundary = 0
  for (const [b, at] of bounds.entries()) if (Math.abs(at - t) < Math.abs(bounds[boundary] - t)) boundary = b
  const plus = tidy(round(t - bounds[boundary]))
  const anchor = anchorFor(names, boundary, plus, side)
  return { anchor, seconds: bounds[boundary] + plus, label: labelOf(anchor), snapped: null }
}

/** The boundary nearest to a moment: where a region or a turn is dropped. */
function nearestBoundary(timeline, seconds) {
  const bounds = boundariesOf(timeline)
  let best = 0
  for (const [b, at] of bounds.entries()) if (Math.abs(at - seconds) < Math.abs(bounds[best] - seconds)) best = b
  return best
}

/** An anchor moved so many boundaries on, with the seconds beyond it as they were: a Block moved whole regions along keeps its shape. Nothing if there is no such boundary. */
function shiftAnchor(names, anchor, by, side) {
  const at = boundaryOf(names, anchor)
  if (!at) return undefined
  const boundary = at.boundary + by
  if (boundary < 0 || boundary > names.length) return undefined
  return anchorFor(names, boundary, at.plus, side)
}

/** Whether an anchor lies exactly on a boundary, with no seconds beyond it. */
const onBoundary = (anchor) => !anchor.plus

/** The tempo each region is under, from a tempo map as a draft holds it: a number, 'mood', or null for free time. As the package says it; the check is the package's. */
function tempoUnder(names, tempo) {
  const points = (tempo ?? []).map((point) => ({ at: point.region === undefined ? 0 : (regionIndexOf(names, point.region, point.hearing) ?? -1), bpm: point.bpm })).filter((point) => point.at >= 0)
  return names.map((_, r) => {
    let current
    for (const point of points) if (point.at <= r) current = point
    return current ? current.bpm : 'mood'
  })
}

/** The names of the regions a stretch of the timeline covers, in order. */
function coveredBy(timeline, from, to) {
  return timeline.regions.filter((region) => region.startSeconds < to - 1e-9 && region.startSeconds + region.seconds > from + 1e-9).map((region) => region.name)
}

if (typeof module !== 'undefined') module.exports = { tempoUnder, anchorAt, anchorFor, boundaryOf, coveredBy, labelOf, nearestBoundary, onBoundary, regionIndexOf, regionRef, shiftAnchor, heardCounts, barsOf, boundariesOf }
