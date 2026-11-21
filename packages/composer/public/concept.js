// What every concept's page shares: a few helpers, and the waking of the page. The page is drawn by the concept's own
// view.js, which defines drawConcept(root, data, record). Nothing here names a concept.

/** A colour from a part's id, computed and never looked up: the same id is always the same colour. */
function colour(id) {
  let h = 0
  for (const letter of id) h = (h * 31 + letter.charCodeAt(0)) >>> 0
  return `hsl(${h % 360} 58% 62%)`
}

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}
const $ = (id) => document.getElementById(id)

const seconds = (value) => `${value.toFixed(1)} s`
const beatsOf = (value) => `${Number.isInteger(value) ? value : value.toFixed(1)} beats`
const growsWords = "grows with the Song's age"

addEventListener('load', async () => {
  const id = location.pathname.split('/').filter(Boolean)[0]
  const [records, data] = await Promise.all([fetch('/concepts.json').then((r) => r.json()), fetch(`/${id}.json`).then((r) => r.json())])
  const record = records.find((concept) => concept.id === id)
  document.title = `${record.title} · Composer`
  $('title').textContent = record.title
  $('line').textContent = record.line
  $('more').replaceChildren(...record.more.map((paragraph) => el('p', { textContent: paragraph })))
  drawConcept($('root'), data, record)
})

const svgElement = (tag, attributes = {}, ...children) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  node.append(...children)
  return node
}

/**
 * Phrases laid end to end as a piano roll: the beats along, the degree up. Each phrase is { notes: [[degree, beats]], rest, reciting? }.
 * `changed[i]` marks that phrase's notes that differ (in the other colour), `labels[i]` is a word for each of its notes (a syllable),
 * a reciting note is ringed, and `grid` draws the beats and bars (and the sixteenths, if `sixteenths`).
 */
function rollSvg({ phrases, changed = [], labels = [], grid = false, sixteenths = false, beat = 24, row = 9, gap = 10 }) {
  const degrees = phrases.flatMap((phrase) => phrase.notes.map(([degree]) => degree))
  const [low, high] = [Math.min(...degrees) - 1, Math.max(...degrees) + 1]
  const height = (high - low + 1) * row
  let at = 0
  const marks = []
  const notes = []
  phrases.forEach((phrase, p) => {
    let x = at
    phrase.notes.forEach(([degree, beats], n) => {
      const rect = svgElement('rect', {
        x: x * beat,
        y: (high - degree) * row,
        width: Math.max(2, beats * beat - 1.5),
        height: row - 2,
        rx: 2,
        fill: changed[p]?.[n] ? 'var(--shapes)' : 'var(--made)',
      })
      notes.push(rect)
      if (phrase.reciting === n) notes.push(svgElement('rect', { x: x * beat - 2, y: (high - degree) * row - 2, width: Math.max(2, beats * beat - 1.5) + 4, height: row + 2, rx: 3, fill: 'none', stroke: 'var(--words)', 'stroke-dasharray': '3 2' }))
      const label = labels[p]?.[n]
      // the labels stand on two rows, so that short notes do not write over one another
      if (label) notes.push(svgElement('text', { x: x * beat + 2, y: height + 13 + (n % 2) * 13, fill: 'var(--words)', 'font-size': 11 }, label))
      x += beats
    })
    marks.push(at)
    at = x + phrase.rest + gap / beat
  })
  const total = at
  const lines = []
  if (grid) {
    const end = Math.ceil(total)
    for (let q = 0; q <= end * 4; q++) {
      const strong = q % 16 === 0 ? 'var(--dim)' : q % 4 === 0 ? 'var(--line)' : sixteenths ? '#1c1f2b' : undefined
      if (strong) lines.push(svgElement('line', { x1: (q / 4) * beat, x2: (q / 4) * beat, y1: 0, y2: height, stroke: strong }))
    }
  }
  const labelRoom = labels.length ? 34 : 0
  return svgElement('svg', { viewBox: `0 0 ${Math.max(1, total) * beat} ${height + labelRoom}`, class: 'roll', style: `width:${Math.max(1, total) * beat}px;max-width:100%`, role: 'img' }, ...lines, ...notes)
}
