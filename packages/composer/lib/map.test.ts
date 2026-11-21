import { describe, expect, it } from 'bun:test'
import { readConcepts } from './concepts.js'
import { mapOf, type Arrow, type Cell, type MapLayout } from './map.js'

type Lead = { id: string; band: 'shapes' | 'edits' | 'made'; leads: string[] }
const lead = (id: string, band: Lead['band'], leads: string[] = []): Lead => ({ id, band, leads })

const eps = 1e-9
/** Whether an axis-aligned segment enters the inside of a box. */
function enters(a: readonly [number, number], b: readonly [number, number], box: Cell): boolean {
  const [x1, x2] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])]
  const [y1, y2] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])]
  // the segment is a line: it enters the open box if it overlaps it in both axes by more than a point
  return x2 > box.x + eps && x1 < box.x + box.width - eps && y2 > box.y + eps && y1 < box.y + box.height - eps
}

const onEdge = (point: readonly [number, number], box: Cell, edge: Arrow['leaves']) => {
  const [x, y] = point
  const within = (v: number, lo: number, hi: number) => v >= lo - eps && v <= hi + eps
  if (edge === 'top') return Math.abs(y - box.y) < eps && within(x, box.x, box.x + box.width)
  if (edge === 'bottom') return Math.abs(y - (box.y + box.height)) < eps && within(x, box.x, box.x + box.width)
  if (edge === 'left') return Math.abs(x - box.x) < eps && within(y, box.y, box.y + box.height)
  return Math.abs(x - (box.x + box.width)) < eps && within(y, box.y, box.y + box.height)
}

/** What must hold of any map, said as tests. */
function provesItself(layout: MapLayout, leads: readonly Lead[]) {
  const boxes = new Map(layout.boxes.map((b) => [b.id, b]))
  expect(layout.arrows).toHaveLength(leads.reduce((sum, { leads: l }) => sum + l.length, 0))
  for (const arrow of layout.arrows) {
    const from = boxes.get(arrow.from)!
    const to = boxes.get(arrow.to)!
    // it goes from its box to the one it leads into, by the edges it says
    expect(onEdge(arrow.points[0]!, from, arrow.leaves)).toBe(true)
    expect(onEdge(arrow.points.at(-1)!, to, arrow.arrives)).toBe(true)
    // it only runs along the axes
    for (let i = 1; i < arrow.points.length; i++) {
      const [a, b] = [arrow.points[i - 1]!, arrow.points[i]!]
      expect(Math.abs(a[0] - b[0]) < eps || Math.abs(a[1] - b[1]) < eps).toBe(true)
    }
    // and never through the inside of any box
    for (let i = 1; i < arrow.points.length; i++) {
      for (const box of layout.boxes) {
        expect(enters(arrow.points[i - 1]!, arrow.points[i]!, box)).toBe(false)
      }
    }
    // it stays on the map
    for (const [x, y] of arrow.points) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(layout.width)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(layout.height)
    }
  }
  // no arrow leaves a box by an edge another arrives at
  const arrivals = new Set(layout.arrows.map((a) => `${a.to}:${a.arrives}`))
  for (const arrow of layout.arrows) expect(arrivals.has(`${arrow.from}:${arrow.leaves}`)).toBe(false)
  // the boxes do not overlap one another, and none stands outside the map
  for (const [i, a] of layout.boxes.entries()) {
    expect(a.x + a.width).toBeLessThanOrEqual(layout.width)
    expect(a.y + a.height).toBeLessThanOrEqual(layout.height)
    for (const b of layout.boxes.slice(i + 1)) {
      expect(a.x + a.width <= b.x + eps || b.x + b.width <= a.x + eps || a.y + a.height <= b.y + eps || b.y + b.height <= a.y + eps).toBe(true)
    }
  }
}

describe('the map of the ten concepts', () => {
  it('proves itself: no arrow through a box, none leaving where another arrives', async () => {
    const concepts = await readConcepts()
    provesItself(mapOf(concepts), concepts)
  })

  it('stands the boxes by their bands, top to bottom, in the order of their numbers', async () => {
    const layout = mapOf(await readConcepts())
    const rowOf = (id: string) => layout.boxes.find((b) => b.id === id)!.row
    expect(layout.rows.map(({ band }) => band)).toEqual(['shapes', 'edits', 'made'])
    expect(['mood', 'perspectives', 'tides'].map(rowOf)).toEqual([0, 0, 0])
    expect(['arrangement', 'parts'].map(rowOf)).toEqual([1, 1])
    expect(['tune', 'lyrics', 'score', 'beds', 'song'].map(rowOf)).toEqual([2, 2, 2, 2, 2])
    expect(layout.boxes.filter((b) => b.band === 'made').map((b) => b.id)).toEqual(['tune', 'lyrics', 'score', 'beds', 'song'])
  })

  it('arrives from above at the top of Tune and Lyrics, and leaves them from below or the side', async () => {
    const layout = mapOf(await readConcepts())
    const edges = (id: string) => ({ in: layout.arrows.filter((a) => a.to === id).map((a) => a.arrives), out: layout.arrows.filter((a) => a.from === id).map((a) => a.leaves) })
    expect(edges('tune').in).toEqual(['top', 'top'])
    expect(edges('tune').out).toEqual(['bottom'])
    expect(edges('lyrics').in).toEqual(['top'])
    expect(edges('lyrics').out.sort()).toEqual(['bottom', 'right'])
  })
})

describe('made-up maps', () => {
  it('a band of eight, wider than a page, with leads next, far, and back', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `box-${i + 1}`)
    const leads: Lead[] = ids.map((id, i) => lead(id, 'made', i === 0 ? ['box-2', 'box-6'] : i === 7 ? ['box-1', 'box-4'] : i === 2 ? ['box-7'] : []))
    const layout = mapOf(leads)
    provesItself(layout, leads)
    expect(layout.boxes.map((b) => b.row)).toEqual(Array(8).fill(0))
    expect(layout.width).toBeGreaterThan(8 * 12)
  })

  it('a lead from the top band to the bottom band crosses the band between by a gutter', () => {
    const leads = [lead('a', 'shapes', ['z']), lead('b', 'shapes'), lead('m', 'edits'), lead('n', 'edits'), lead('y', 'made'), lead('z', 'made')]
    const layout = mapOf(leads)
    provesItself(layout, leads)
    const arrow = layout.arrows[0]!
    // it goes down through the middle band, which has boxes in the way of a straight line: one segment spans the whole band
    const [top, bottom] = [layout.rows[1]!.y, layout.rows[1]!.y + 10.5]
    const spans = arrow.points.slice(1).some((point, i) => {
      const previous = arrow.points[i]!
      return Math.abs(previous[0] - point[0]) < 1e-9 && Math.min(previous[1], point[1]) < top && Math.max(previous[1], point[1]) > bottom
    })
    expect(spans).toBe(true)
  })

  it('two leads into one box, from both sides of it, and one back up', () => {
    const leads = [lead('left', 'made', ['middle']), lead('middle', 'made', ['up']), lead('right', 'made', ['middle', 'left']), lead('up', 'shapes')]
    const layout = mapOf(leads)
    provesItself(layout, leads)
    const intoMiddle = layout.arrows.filter((a) => a.to === 'middle')
    expect(intoMiddle).toHaveLength(2)
    // one comes straight across, the other round under the band: both arrive at its left, where arrows arrive
    expect(intoMiddle.map((a) => a.arrives)).toEqual(['left', 'left'])
    expect(intoMiddle.map((a) => a.leaves).sort()).toEqual(['bottom', 'right'])
    // a lead up arrives at the top, and leaves the side
    const up = layout.arrows.find((a) => a.to === 'up')!
    expect([up.leaves, up.arrives]).toEqual(['right', 'top'])
  })

  it('a lone box, no leads, a single band', () => {
    const leads = [lead('only', 'edits')]
    const layout = mapOf(leads)
    provesItself(layout, leads)
    expect(layout.rows).toHaveLength(1)
  })

  it('spreads arrows that arrive at one edge, so that each has a head of its own', () => {
    const leads = [lead('a', 'shapes', ['t']), lead('b', 'shapes', ['t']), lead('c', 'shapes', ['t']), lead('t', 'made')]
    const layout = mapOf(leads)
    provesItself(layout, leads)
    const xs = layout.arrows.map((a) => a.points.at(-1)![0])
    expect(new Set(xs).size).toBe(3)
  })
})
