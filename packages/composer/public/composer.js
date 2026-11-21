// The Composer's page: it names no part. Everything it shows comes from /parts.json and /arrangements.json.

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

const seconds = (value) => `${value.toFixed(1)} s`
const beatsOf = (value) => `${Number.isInteger(value) ? value : value.toFixed(1)} beats`

let parts = []
let arrangements = []

function showParts() {
  document.getElementById('cards').replaceChildren(
    ...parts.map((part) => {
      const facts = [part.words === 'written' ? 'words written by the mind' : 'no words', part.ending === 'full' ? 'ends at home' : 'ends open', part.beats ? `fixed at ${beatsOf(part.beats)}` : 'as long as its lines']
      const table = el(
        'table',
        {},
        el('thead', {}, el('tr', {}, ...['parameter', 'range', 'usual', ''].map((name) => el('th', { textContent: name })))),
        el(
          'tbody',
          {},
          ...part.parameters.map((p) =>
            el('tr', {}, el('td', { textContent: p.name }), el('td', { textContent: `${p.minimum ?? '…'} to ${p.maximum ?? '…'}` }), el('td', { textContent: p.default ?? '' }), el('td', { textContent: p.description ?? '' })),
          ),
        ),
      )
      const card = el(
        'article',
        { className: `card${part.state === 'active' ? '' : ' retired'}` },
        el('h3', { textContent: part.title }),
        el('div', { className: 'id', textContent: `${part.id}${part.state === 'active' ? '' : ` · ${part.state}`}` }),
        el('p', { textContent: part.text }),
        el('div', { className: 'facts', textContent: facts.join(' · ') }),
        part.parameters.length ? table : el('p', { className: 'facts', textContent: 'No parameters.' }),
      )
      card.style.setProperty('--colour', colour(part.id))
      return card
    }),
  )
}

function showArrangement() {
  const chosen = arrangements.find((a) => a.id === document.getElementById('which').value) ?? arrangements[0]
  const diagram = document.getElementById('diagram')
  if (!chosen) {
    diagram.replaceChildren()
    return
  }
  const { layout } = chosen
  document.getElementById('about').textContent = chosen.text
  document.getElementById('total').textContent = `${layout.instances.length} parts · ${beatsOf(layout.beats)} · ${seconds(layout.seconds)}`
  // the words that are sung more than once are marked alike, by a letter, in the order they first appear
  const letters = new Map()
  for (const instance of layout.instances) if (instance.words === 'written' && !letters.has(instance.name)) letters.set(instance.name, String.fromCharCode(65 + letters.size))

  // the whole Arrangement is drawn to fit the page's width, if it can be read there; longer, and it scrolls
  const room = document.querySelector('.scroll').clientWidth - 4 * layout.instances.length
  const beat = Math.max(3.5, room / layout.beats)
  diagram.style.setProperty('--beat', `${beat}px`)

  const blocks = layout.instances.map((instance) => {
    const block = el('div', { className: `block${instance.beats * beat < 110 ? ' narrow' : ''}` })
    block.dataset.name = instance.name
    block.style.width = `calc(var(--beat) * ${instance.beats})`
    block.style.background = colour(instance.part)
    block.title = `${instance.name}: a ${instance.part}, from ${seconds(instance.startSeconds)} for ${seconds(instance.seconds)}`
    block.append(
      el('div', { className: 'name', textContent: instance.name }),
      el('div', { className: 'what', textContent: instance.part }),
      el('div', { className: 'time', textContent: `${seconds(instance.seconds)} · ${beatsOf(instance.beats)}` }),
    )
    if (instance.words === 'none') {
      block.append(el('div', { className: 'journey', textContent: `from ${instance.before ?? 'the start'} to ${instance.after ?? 'the end'}` }))
    } else {
      const heard = instance.heardAgain.length ? `${letters.get(instance.name)} · again at ${instance.heardAgain.map((i) => i + 1).join(', ')}` : letters.get(instance.name)
      block.append(el('div', { className: 'words', textContent: heard, title: instance.heardAgain.length ? 'The same words are sung where the same mark is' : 'These words are sung once' }))
    }
    block.append(el('span', { className: `end ${instance.ending}`, title: instance.ending === 'full' ? 'ends at home' : 'ends open, on the fifth' }))
    block.addEventListener('mouseenter', () => blocksNamed(instance.name, true))
    block.addEventListener('mouseleave', () => blocksNamed(instance.name, false))
    return block
  })
  diagram.replaceChildren(...blocks)

  // and in order, in words, for what the blocks are too narrow to say
  const row = (cells, tag = 'td') => el('tr', {}, ...cells.map((cell) => el(tag, { textContent: cell })))
  document.getElementById('order').replaceChildren(
    el('thead', {}, row(['#', 'name', 'part', 'from', 'lasts', 'beats', 'ends', 'words / journey'], 'th')),
    el(
      'tbody',
      {},
      ...layout.instances.map((i) =>
        row([
          i.index + 1,
          i.name,
          i.part,
          seconds(i.startSeconds),
          seconds(i.seconds),
          i.beats,
          i.ending === 'full' ? 'at home' : 'open',
          i.words === 'none' ? `hums from ${i.before ?? 'the start'} to ${i.after ?? 'the end'}` : `${letters.get(i.name)}${i.heardAgain.length ? `, again at ${i.heardAgain.map((n) => n + 1).join(', ')}` : ', once'}`,
        ]),
      ),
    ),
  )

  // the key: each part in its colour, and what the circle says
  const used = [...new Set(layout.instances.map((i) => i.part))]
  document.getElementById('key').replaceChildren(
    ...used.map((id) => el('li', {}, Object.assign(el('span', { className: 'swatch' }), { style: `background:${colour(id)}` }), id)),
    el('li', {}, el('span', { className: 'end full' }), 'ends at home'),
    el('li', {}, el('span', { className: 'end' }), 'ends open'),
    el('li', {}, 'the same letter: the same words'),
  )
}

function blocksNamed(name, lit) {
  for (const block of document.querySelectorAll('.block')) if (block.dataset.name === name) block.classList.toggle('lit', lit)
}

async function load() {
  const tempo = Number(document.getElementById('tempo').value) || 72
  const [partsJson, arrangementsJson] = await Promise.all([fetch('/parts.json').then((r) => r.json()), fetch(`/arrangements.json?tempo=${tempo}`).then((r) => r.json())])
  parts = partsJson
  arrangements = arrangementsJson
  const which = document.getElementById('which')
  const before = which.value
  which.replaceChildren(...arrangements.map((a) => el('option', { value: a.id, textContent: a.title })))
  if (arrangements.some((a) => a.id === before)) which.value = before
  showParts()
  showArrangement()
}

document.getElementById('which').addEventListener('change', showArrangement)
document.getElementById('tempo').addEventListener('change', load)
load()
