// The layout of the map of the concepts (plan "Evolution of Song", steps 5 and 6): where every box stands, and the
// polyline of every arrow, in grid units, as plain numbers, as `layoutOf` gives an Arrangement's drawing. The page only
// scales it and draws it. Nothing is written per concept: a concept finds its place by its band, and its arrows by its leads.
//
// The rules the routing keeps, so that they can be proved and not only seen:
//   - an arrow arrives at the top or the left of a box, and leaves from its bottom or its right: no arrow leaves a box by an
//     edge another arrives at, so a reader can tell the ones that come in from the ones that go out;
//   - an arrow never passes through the inside of a box. It runs in the corridors between the bands and in the gutters between
//     the columns of boxes, which are the same in every band, and are free all the way down.
// The kinds of lead:
//   - to the next box in its band: straight across, from the right edge to the left;
//   - to any other box in its band: out of the bottom, along the corridor under the band, and up the gutter to the left of the box, into its left;
//   - to a band below: out of the bottom, along the corridor, down the gutters of the bands between, into the top;
//   - to a band above: out of the right edge, up its gutter to the corridor above the band, into the top.

import { bands, type Concept } from './concepts.js'

/** Sizes, in grid units. */
export const sizes = { box: { width: 12, height: 10.5 }, gap: 2.5, corridor: 6.5 } as const

export type Edge = 'top' | 'bottom' | 'left' | 'right'
export type Point = readonly [x: number, y: number]

export type Cell = { id: string; band: string; row: number; column: number; x: number; y: number; width: number; height: number }
export type Arrow = { from: string; to: string; band: string; leaves: Edge; arrives: Edge; points: Point[] }
export type MapLayout = { width: number; height: number; unit: typeof sizes; rows: { band: string; says: string; y: number }[]; boxes: Cell[]; arrows: Arrow[] }

type Lead = Pick<Concept, 'id' | 'band' | 'leads'>

/** The map of concepts: boxes by band, arrows by leads. */
export function mapOf(concepts: readonly Lead[]): MapLayout {
  const { box, gap, corridor } = sizes
  const rowsUsed = bands.filter(({ id }) => concepts.some((concept) => concept.band === id))
  const columns = Math.max(1, ...rowsUsed.map(({ id }) => concepts.filter((concept) => concept.band === id).length))
  // room at the left for the bands' names, and the gutter beside it for the arrows that go round
  const pad = gap + 1.5
  const width = pad * 2 + columns * box.width + (columns - 1) * gap
  const bandTop = (row: number) => corridor + row * (box.height + corridor)
  const height = rowsUsed.length * (box.height + corridor) + corridor

  const boxes: Cell[] = []
  rowsUsed.forEach(({ id }, row) =>
    concepts
      .filter((concept) => concept.band === id)
      .forEach((concept, column) => boxes.push({ id: concept.id, band: id, row, column, x: pad + column * (box.width + gap), y: bandTop(row), width: box.width, height: box.height })),
  )
  const cell = new Map(boxes.map((b) => [b.id, b]))

  // the channels: the middle of the gutter to the right of column c (and, at -1, the margin to the left of the first)
  const gutterX = (column: number) => pad + column * (box.width + gap) + box.width + gap / 2
  const gutterNear = (x: number) => {
    let best = -1
    for (let c = -1; c < columns; c++) if (Math.abs(gutterX(c) - x) < Math.abs(gutterX(best) - x)) best = c
    return best
  }
  // corridor k lies above band k; corridor `rows` lies under the last
  const corridorY = (k: number) => k * (box.height + corridor) + corridor / 2
  const lanes = new Map<string, number>()
  const lane = (key: string) => {
    const n = lanes.get(key) ?? 0
    lanes.set(key, n + 1)
    return n
  }
  const laneY = (k: number) => corridorY(k) + ((lane(`c${k}`) % 9) - 4) * 0.55
  const channel = (column: number) => gutterX(column) + ((lane(`g${column}`) % 5) - 2) * 0.5

  // first the kind of every lead and its edges, so that the ports on an edge can be spread
  type Plan = { from: Cell; to: Cell; kind: 'across' | 'around' | 'down' | 'up'; leaves: Edge; arrives: Edge }
  const plans: Plan[] = []
  for (const concept of concepts) {
    for (const lead of concept.leads) {
      const from = cell.get(concept.id)
      const to = cell.get(lead)
      if (!from || !to) continue
      if (from.row === to.row) {
        if (to.column === from.column + 1) plans.push({ from, to, kind: 'across', leaves: 'right', arrives: 'left' })
        else plans.push({ from, to, kind: 'around', leaves: 'bottom', arrives: 'left' })
      } else if (to.row > from.row) plans.push({ from, to, kind: 'down', leaves: 'bottom', arrives: 'top' })
      else plans.push({ from, to, kind: 'up', leaves: 'right', arrives: 'top' })
    }
  }
  const ports = new Map<string, number>()
  const count = new Map<string, number>()
  const key = (id: string, edge: Edge) => `${id}:${edge}`
  for (const { from, to, leaves, arrives } of plans) {
    count.set(key(from.id, leaves), (count.get(key(from.id, leaves)) ?? 0) + 1)
    count.set(key(to.id, arrives), (count.get(key(to.id, arrives)) ?? 0) + 1)
  }
  const port = (cellOf: Cell, edge: Edge): Point => {
    const k = key(cellOf.id, edge)
    const index = ports.get(k) ?? 0
    ports.set(k, index + 1)
    const share = (index + 1) / ((count.get(k) ?? 1) + 1)
    if (edge === 'top') return [cellOf.x + cellOf.width * share, cellOf.y]
    if (edge === 'bottom') return [cellOf.x + cellOf.width * share, cellOf.y + cellOf.height]
    if (edge === 'left') return [cellOf.x, cellOf.y + cellOf.height * share]
    return [cellOf.x + cellOf.width, cellOf.y + cellOf.height * share]
  }

  const arrows: Arrow[] = plans.map(({ from, to, kind, leaves, arrives }) => {
    const start = port(from, leaves)
    const end = port(to, arrives)
    let points: Point[]
    if (kind === 'across') {
      const gx = channel(from.column)
      points = [start, [gx, start[1]], [gx, end[1]], end]
    } else if (kind === 'around') {
      // under the band, and up the gutter to the left of the box it leads into
      const under = laneY(from.row + 1)
      const gx = channel(to.column - 1)
      points = [start, [start[0], under], [gx, under], [gx, end[1]], end]
    } else if (kind === 'down') {
      points = [start]
      let x = start[0]
      for (let k = from.row + 1; k <= to.row; k++) {
        const y = laneY(k)
        points.push([x, y])
        if (k < to.row) {
          // down through band k, by the gutter nearest the box it leads into
          const gx = channel(gutterNear(end[0]))
          points.push([gx, y])
          x = gx
        } else points.push([end[0], y])
      }
      points.push(end)
    } else {
      // up: out of the right edge into the gutter beside, up it to the corridor above the target's band, and down into its top
      const gx = channel(from.column)
      const above = laneY(to.row)
      points = [start, [gx, start[1]], [gx, above], [end[0], above], end]
    }
    return { from: from.id, to: to.id, band: from.band, leaves, arrives, points }
  })

  return { width, height, unit: sizes, rows: rowsUsed.map(({ id, says }, row) => ({ band: id, says, y: bandTop(row) })), boxes, arrows }
}
