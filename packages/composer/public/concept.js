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

/** Loads a script of the concept's own folder: whether there was one. */
const loadScript = (src) =>
  new Promise((done) => {
    const script = Object.assign(document.createElement('script'), { src, onload: () => done(true), onerror: () => done(false) })
    document.head.append(script)
  })

addEventListener('load', async () => {
  const id = location.pathname.split('/').filter(Boolean)[0]
  const [records, data] = await Promise.all([fetch('/concepts.json').then((r) => r.json()), fetch(`/${id}.json`).then((r) => r.json())])
  const record = records.find((concept) => concept.id === id)
  document.title = `${record.title} · Composer`
  drawToggle($('mode'))
  $('to-the-map').href = inMode('/')
  $('title').textContent = record.title
  $('line').textContent = record.line
  // Learn explains, with words and diagrams; Edit is for working, and its words are the short line: the explaining stays in Learn
  $('more').replaceChildren(...(mode === 'learn' ? record.more.map((paragraph) => el('p', { textContent: paragraph })) : []))
  document.body.dataset.mode = mode
  // what the page's two modes share, then the one it is in
  await loadScript(`/${id}/shared.js`)
  if (mode === 'learn') {
    await loadScript(`/${id}/view.js`)
    drawConcept($('root'), data, record)
    return
  }
  const kind = editKinds[record.edits] ?? record.edits
  if (record.edits === 'nothing') {
    $('root').replaceChildren(el('p', { className: 'pending', textContent: 'There is nothing to edit here. It is explained in Learn.' }))
  } else if (await loadScript(`/${id}/edit.js`)) {
    drawEdit($('root'), data, record)
  } else {
    $('root').replaceChildren(el('p', { className: 'pending', textContent: `This is ${kind}, and its workspace is not built yet. It is explained in Learn.` }))
  }
})

/** What a concept's page in Edit is, in a few words, as the record says it. */
const editKinds = { files: 'a workspace for files you keep', parameters: 'a workspace for the parameters of parts, kept in another file', bench: 'a bench, where nothing is saved' }

const svgElement = (tag, attributes = {}, ...children) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  node.append(...children)
  return node
}

/**
 * Phrases laid end to end as a piano roll: the beats along, the degree up. Each phrase is { notes: [[degree, beats]], rest, reciting? }.
 * `changed[i]` marks that phrase's notes that differ (in the other colour), `captions` are words set under the first phrase, each { at (beats), text, row, rough },
 * a reciting note is ringed, and `grid` draws the beats and bars (and the sixteenths, if `sixteenths`).
 */
function rollSvg({ phrases, changed = [], captions = [], grid = false, sixteenths = false, beat = 24, row = 9, gap = 10 }) {
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
  // the captions come with their rows: the server has set them so that none touches another
  const rows = captions.reduce((most, caption) => Math.max(most, caption.row + 1), 0)
  const labelRoom = rows ? rows * 13 + 6 : 0
  for (const caption of captions) notes.push(svgElement('text', { x: caption.at * beat + 2, y: height + 12 + caption.row * 13, fill: 'var(--words)', 'font-size': 11, 'font-style': caption.rough ? 'italic' : 'normal' }, caption.text))
  return svgElement('svg', { viewBox: `0 0 ${Math.max(1, total) * beat} ${height + labelRoom}`, class: 'roll', style: `width:${Math.max(1, total) * beat}px;max-width:100%`, role: 'img' }, ...lines, ...notes)
}
