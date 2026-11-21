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
