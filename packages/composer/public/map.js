// The map of the concepts: drawn from /concepts.json, laid out by band, top to bottom, with no place written for any concept.
// A box is a concept, a link to its page; an arrow is a lead from one to the next. Nothing here names a concept.

const bandWords = { shapes: 'Shapes it', edits: 'Composer edits', made: 'Made every Song' }
const bandOrder = ['shapes', 'edits', 'made']

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

let concepts = []

function layout() {
  const map = document.getElementById('map')
  const bands = bandOrder.filter((band) => concepts.some((concept) => concept.band === band))
  const rows = bands.map((band) => {
    const row = make('section', { className: `band ${band}` }, make('h2', { textContent: bandWords[band] }))
    const boxes = make('div', { className: 'boxes' })
    for (const concept of concepts.filter((c) => c.band === band)) {
      const box = make('a', { className: 'box', href: `/${concept.id}/` }, make('strong', { textContent: concept.title }), make('span', { textContent: concept.line }))
      box.dataset.id = concept.id
      boxes.append(box)
    }
    row.append(boxes)
    return row
  })
  const arrows = svg('svg', { class: 'arrows', 'aria-hidden': 'true' })
  arrows.append(
    (() => {
      const defs = svg('defs')
      const marker = svg('marker', { id: 'head', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' })
      marker.append(svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'currentColor' }))
      defs.append(marker)
      return defs
    })(),
  )
  map.replaceChildren(arrows, ...rows)
  drawArrows()
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

/**
 * The arrows. A lead into a band below goes down into the corridor between the bands, along it, and down the gutter
 * between two boxes of any band it has to cross, to the top of the box it leads into; one within a band goes straight
 * across if the next box is the one, and over the top of the boxes between if not. Drawn from where the boxes stand,
 * so a concept added anywhere finds its arrows by its band and its leads.
 */
function drawArrows() {
  const map = document.getElementById('map')
  const arrows = map.querySelector('.arrows')
  for (const old of arrows.querySelectorAll('path.lead')) old.remove()
  const mapBox = map.getBoundingClientRect()
  arrows.setAttribute('width', map.scrollWidth)
  arrows.setAttribute('height', mapBox.height)
  const rect = (element) => {
    const box = element.getBoundingClientRect()
    return { left: box.left - mapBox.left + map.scrollLeft, right: box.right - mapBox.left + map.scrollLeft, top: box.top - mapBox.top, bottom: box.bottom - mapBox.top }
  }
  const bandRows = [...map.querySelectorAll('.band')].map((section) => {
    const boxes = [...section.querySelectorAll('.box')].map((element) => ({ id: element.dataset.id, ...rect(element) })).sort((a, b) => a.left - b.left)
    return { band: [...section.classList].find((name) => bandOrder.includes(name)), boxes, top: Math.min(...boxes.map((b) => b.top)), bottom: Math.max(...boxes.map((b) => b.bottom)) }
  })
  const where = new Map()
  bandRows.forEach((row, index) => row.boxes.forEach((box) => where.set(box.id, { row: index, box })))

  // the corridor between band i and band i+1, and a lane in it: arrows sharing one are spread a little
  const used = new Map()
  const lane = (corridor) => {
    const count = used.get(corridor) ?? 0
    used.set(corridor, count + 1)
    const above = corridor < 0 ? bandRows[0].top - 24 : (bandRows[corridor].bottom + bandRows[corridor + 1].top) / 2
    return above + ((count % 7) - 3) * 5
  }
  // the gutters of a band: between its boxes, and beside the first and last
  const gutters = (row) => [row.boxes[0].left - 16, ...row.boxes.slice(1).map((box, i) => (row.boxes[i].right + box.left) / 2), row.boxes.at(-1).right + 16]
  const nearest = (xs, x) => xs.reduce((best, candidate) => (Math.abs(candidate - x) < Math.abs(best - x) ? candidate : best))

  for (const from of concepts) {
    for (const lead of from.leads) {
      const a = where.get(from.id)
      const b = where.get(lead)
      if (!a || !b) continue
      const xa = (a.box.left + a.box.right) / 2
      const xb = (b.box.left + b.box.right) / 2
      let points
      if (a.row === b.row) {
        const row = bandRows[a.row]
        const [first, second] = a.box.left < b.box.left ? [a.box, b.box] : [b.box, a.box]
        const between = row.boxes.filter((box) => box.left > first.left && box.left < second.left)
        const y = (a.box.top + a.box.bottom) / 2
        if (!between.length) {
          points = a.box.left < b.box.left ? [[a.box.right, y], [b.box.left, y]] : [[a.box.left, y], [b.box.right, y]]
        } else {
          const over = lane(a.row - 1)
          points = [[xa, a.box.top], [xa, over], [xb, over], [xb, b.box.top]]
        }
      } else if (b.row > a.row) {
        // down: out of the box into the corridor below its band, along it to the gutter (or the box) it goes down at, and so on
        points = [[xa, a.box.bottom]]
        let x = xa
        for (let corridor = a.row; corridor < b.row; corridor++) {
          const y = lane(corridor)
          const next = corridor + 1
          const to = next === b.row ? xb : nearest(gutters(bandRows[next]), xb)
          points.push([x, y], [to, y])
          x = to
        }
        points.push([xb, b.box.top])
      } else {
        // up: the mirror of down, from the top of a box to the bottom of the one it leads into
        const first = lane(a.row - 1)
        points = [[xa, a.box.top], [xa, first], [xb, first], [xb, b.box.bottom]]
      }
      arrows.append(svg('path', { class: `lead ${from.band}`, d: rounded(points), 'marker-end': 'url(#head)', fill: 'none' }))
    }
  }
}

async function load() {
  concepts = await fetch('/concepts.json').then((r) => r.json())
  layout()
}
addEventListener('resize', () => concepts.length && drawArrows())
load()
