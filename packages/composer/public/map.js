// The map of the concepts: drawn from /map.json, where every box stands and every arrow runs, in grid units, worked
// out on the server (lib/map.ts), and from /concepts.json, what each box says. The page only scales it and draws it. It
// names no concept and no band but by what the server says.

const unitPx = 16

const make = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}
const svg = (tag, attributes = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  return node
}

/** A polyline with its corners rounded: the way an arrow bends. */
function rounded(points, radius = 9) {
  const unit = ([ax, ay], [bx, by]) => {
    const length = Math.hypot(bx - ax, by - ay) || 1
    return [(bx - ax) / length, (by - ay) / length, length]
  }
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    const [ux, uy, inLength] = unit(points[i - 1], points[i])
    const [vx, vy, outLength] = unit(points[i], points[i + 1])
    const before = Math.min(radius, inLength / 2)
    const after = Math.min(radius, outLength / 2)
    d += ` L${x - ux * before} ${y - uy * before} Q${x} ${y} ${x + vx * after} ${y + vy * after}`
  }
  const [lx, ly] = points[points.length - 1]
  return `${d} L${lx} ${ly}`
}

async function load() {
  const [concepts, layout] = await Promise.all([fetch('/concepts.json').then((r) => r.json()), fetch('/map.json').then((r) => r.json())])
  const said = new Map(concepts.map((concept) => [concept.id, concept]))
  const px = (value) => value * unitPx

  const map = document.getElementById('map')
  map.style.width = `${px(layout.width)}px`
  map.style.height = `${px(layout.height)}px`

  const arrows = svg('svg', { class: 'arrows', 'aria-hidden': 'true', width: px(layout.width), height: px(layout.height) })
  const defs = svg('defs')
  const head = svg('marker', { id: 'head', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' })
  head.append(svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'currentColor' }))
  defs.append(head)
  arrows.append(defs)
  for (const arrow of layout.arrows) {
    const points = arrow.points.map(([x, y]) => [px(x), px(y)])
    arrows.append(svg('path', { class: `lead ${arrow.band}`, d: rounded(points), 'marker-end': 'url(#head)', fill: 'none' }))
  }

  const labels = layout.rows.map((row) => {
    const label = make('h2', { className: `band-label ${row.band}`, textContent: row.says })
    label.style.top = `${px(row.y)}px`
    label.style.height = `${px(layout.unit.box.height)}px`
    return label
  })
  const boxes = layout.boxes.map((cell) => {
    const concept = said.get(cell.id)
    const box = make('a', { className: `box ${cell.band}`, href: `/${cell.id}/` }, make('strong', { textContent: concept.title }), make('span', { textContent: concept.line }))
    box.dataset.id = cell.id
    Object.assign(box.style, { left: `${px(cell.x)}px`, top: `${px(cell.y)}px`, width: `${px(cell.width)}px`, height: `${px(cell.height)}px` })
    return box
  })
  map.replaceChildren(arrows, ...labels, ...boxes)
}

load()
