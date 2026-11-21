// The Composer's page: it names no part. Everything it shows comes from /parts.json, /arrangements.json
// and /check, and every rule about an Arrangement is the server's: the page never repeats one.

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

let parts = []
let arrangements = []

// ---- the parts

function showParts() {
  $('cards').replaceChildren(
    ...parts.map((part) => {
      const facts = [part.words === 'written' ? 'words written by the mind' : 'no words', part.ending === 'full' ? 'ends at home' : 'ends open', part.beats ? `fixed at ${beatsOf(part.beats)}` : 'as long as its lines']
      const rows = part.parameters.flatMap((p) => [
        el('tr', { className: 'main' }, el('td', { textContent: p.name }), el('td', { textContent: `${p.minimum ?? '…'} to ${p.maximum ?? '…'}` }), el('td', { textContent: p.default ?? '' })),
        ...(p.description ? [el('tr', {}, el('td', { className: 'desc', colSpan: 3, textContent: p.description }))] : []),
      ])
      const table = el('table', {}, el('thead', {}, el('tr', {}, ...['parameter', 'range', 'usual'].map((name) => el('th', { textContent: name })))), el('tbody', {}, ...rows))
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

// ---- drawing a layout, in the viewer and in the editor

/** Draws a layout into a view: its diagram, its key and its table, and says how long it is. */
function draw(layout, { scroll, diagram, key, order, total }) {
  total.textContent = `${layout.instances.length} parts · ${beatsOf(layout.beats)} · ${seconds(layout.seconds)}`
  // the words that are sung more than once are marked alike, by a letter, in the order they first appear
  const letters = new Map()
  for (const instance of layout.instances) if (instance.words === 'written' && !letters.has(instance.name)) letters.set(instance.name, String.fromCharCode(65 + (letters.size % 26)))

  // the whole Arrangement is drawn to fit the page's width, if it can be read there; longer, and it scrolls
  const room = scroll.clientWidth - 4 * layout.instances.length
  const beat = Math.max(3.5, room / Math.max(1, layout.beats))
  diagram.style.setProperty('--beat', `${beat}px`)

  const blocks = layout.instances.map((instance) => {
    const narrow = instance.beats * beat < 110
    const block = el('div', { className: `block${narrow ? ' narrow' : ''}` })
    block.dataset.name = instance.name
    block.style.width = `calc(var(--beat) * ${instance.beats})`
    block.style.background = colour(instance.part)
    // where a block is too narrow to say it, hovering says it all
    block.title = `${instance.name}: a ${instance.part}, from ${seconds(instance.startSeconds)} for ${seconds(instance.seconds)}${instance.grows ? `; ${growsWords}` : ''}`
    block.append(
      el('div', { className: 'name', textContent: instance.name }),
      el('div', { className: 'what', textContent: instance.part }),
      el('div', { className: 'time', textContent: `${seconds(instance.seconds)} · ${beatsOf(instance.beats)}` }),
    )
    if (instance.grows) block.append(el('div', { className: 'what grows', textContent: growsWords }))
    if (instance.words === 'none') {
      block.append(el('div', { className: 'journey', textContent: `from ${instance.before ?? 'the start'} to ${instance.after ?? 'the end'}` }))
    } else {
      const heard = instance.heardAgain.length ? `${letters.get(instance.name)} · again at ${instance.heardAgain.map((i) => i + 1).join(', ')}` : letters.get(instance.name)
      block.append(el('div', { className: 'words', textContent: heard, title: instance.heardAgain.length ? 'The same words are sung where the same mark is' : 'These words are sung once' }))
    }
    block.append(el('span', { className: `end ${instance.ending}`, title: instance.ending === 'full' ? 'ends at home' : 'ends open, on the fifth' }))
    const light = (on) => diagram.querySelectorAll('.block').forEach((other) => other.dataset.name === instance.name && other.classList.toggle('lit', on))
    block.addEventListener('mouseenter', () => light(true))
    block.addEventListener('mouseleave', () => light(false))
    return block
  })
  diagram.replaceChildren(...blocks)

  // the key: each part in its colour, and what the circle says
  const used = [...new Set(layout.instances.map((i) => i.part))]
  key.replaceChildren(
    ...used.map((id) => el('li', {}, Object.assign(el('span', { className: 'swatch' }), { style: `background:${colour(id)}` }), id)),
    el('li', {}, el('span', { className: 'end full' }), 'ends at home'),
    el('li', {}, el('span', { className: 'end' }), 'ends open'),
    el('li', {}, 'the same letter: the same words'),
  )

  // and in order, in words, for what the blocks are too narrow to say
  const row = (cells, tag = 'td') => el('tr', {}, ...cells.map((cell) => el(tag, { textContent: cell })))
  order.replaceChildren(
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
          i.words === 'none'
            ? `hums from ${i.before ?? 'the start'} to ${i.after ?? 'the end'}`
            : `${letters.get(i.name)}${i.heardAgain.length ? `, again at ${i.heardAgain.map((n) => n + 1).join(', ')}` : ', once'}${i.grows ? `; ${growsWords}` : ''}`,
        ]),
      ),
    ),
  )
}

const viewer = { scroll: document.querySelector('#arrangements ~ .scroll'), diagram: $('diagram'), key: $('key'), order: $('order'), total: $('total') }
const editing = { scroll: document.querySelector('#edit-view .scroll'), diagram: $('edit-diagram'), key: $('edit-key'), order: $('edit-order'), total: $('edit-total') }

function showArrangement() {
  const chosen = arrangements.find((a) => a.id === $('which').value) ?? arrangements[0]
  if (!chosen) {
    viewer.diagram.replaceChildren()
    return
  }
  $('about').textContent = chosen.text
  draw(chosen.layout, viewer)
}

// ---- the editor

/** The Arrangement being edited: what is saved is what the Composer accepted, as it stands. */
let draft
/** The last drawing the Composer accepted, kept dimmed beneath a refusal. */
let lastGood
let checking = 0
const draftKey = 'composer:draft'

const remember = () => {
  try {
    localStorage.setItem(draftKey, JSON.stringify(draft))
  } catch {}
}
const recalled = () => {
  try {
    const kept = JSON.parse(localStorage.getItem(draftKey) ?? 'null')
    return kept && typeof kept === 'object' ? kept : undefined
  } catch {
    return undefined
  }
}

const tempo = () => Number($('tempo').value) || 72
const activeParts = () => parts.filter((part) => part.state === 'active')

/** The declaration as the files are written: its fields a line each, an instance to a line. */
function serialize(value) {
  const inline = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : JSON.stringify(v))
  const instances = draft.instances.map((instance) => `    ${inline(instance)}`).join(',\n')
  return `{\n  "id": ${JSON.stringify(value.id)},\n  "title": ${JSON.stringify(value.title)},\n  "instances": [${instances ? `\n${instances}\n  ` : ''}]\n}\n`
}

async function check() {
  const mine = ++checking
  remember()
  let answer
  try {
    answer = await fetch(`/check?tempo=${tempo()}`, { method: 'POST', body: JSON.stringify(draft) }).then((r) => r.json())
  } catch {
    answer = { refusal: 'the Composer cannot be reached' }
  }
  if (mine !== checking) return
  const verdict = $('verdict')
  if (answer.layout) {
    lastGood = answer.layout
    verdict.className = 'verdict accepted'
    verdict.textContent = 'This Arrangement is accepted.'
    $('save').disabled = false
    $('edit-view').classList.remove('dim')
    draw(answer.layout, editing)
  } else {
    verdict.className = 'verdict refused'
    verdict.textContent = answer.refusal
    $('save').disabled = true
    // the last good drawing stays beneath, dimmed
    $('edit-view').classList.toggle('dim', Boolean(lastGood))
    if (lastGood) draw(lastGood, editing)
  }
}

/** The names that more than one instance wears, with where they are worn, for the words beside a name. */
function sharing() {
  const where = new Map()
  draft.instances.forEach((instance, i) => where.set(instance.name, [...(where.get(instance.name) ?? []), i + 1]))
  return where
}

function paramControl(instance, definition) {
  const input = el('input', { type: 'number', step: 'any', placeholder: definition.default ?? '' })
  input.dataset.param = definition.name
  if (definition.minimum !== undefined) input.min = definition.minimum
  if (definition.maximum !== undefined) input.max = definition.maximum
  const set = instance.parameters?.[definition.name]
  if (set !== undefined) input.value = set
  const reset = el('button', { type: 'button', textContent: 'reset', hidden: set === undefined })
  const settle = () => {
    // a parameter left alone is not written: the part's own stands
    if (input.value === '') {
      if (instance.parameters) delete instance.parameters[definition.name]
      if (instance.parameters && !Object.keys(instance.parameters).length) delete instance.parameters
    } else {
      instance.parameters = { ...(instance.parameters ?? {}), [definition.name]: Number(input.value) }
    }
    reset.hidden = input.value === ''
    check()
  }
  input.addEventListener('input', settle)
  reset.addEventListener('click', () => {
    input.value = ''
    settle()
  })
  const label = el('label', { className: 'param' }, el('span', { textContent: `${definition.name} (${definition.minimum ?? '…'} to ${definition.maximum ?? '…'}, usually ${definition.default ?? 'none'})` }), el('span', {}, input, ' ', reset))
  if (definition.description) label.append(el('small', { textContent: definition.description }))
  return label
}

/** The rows of instances, drawn again whenever their number, order or parts change. */
function showRows() {
  $('draft-id').value = draft.id
  $('draft-title').value = draft.title
  const shares = sharing()
  $('instances').replaceChildren(
    ...draft.instances.map((instance, i) => {
      const part = parts.find((p) => p.id === instance.part)
      const li = el('li', { className: 'row' })
      li.style.setProperty('--colour', colour(instance.part))
      const name = el('input', { type: 'text', className: 'iname', value: instance.name, autocomplete: 'off', spellcheck: false })
      const said = el('span', { className: 'shares' })
      const say = () => {
        const others = (shares.get(instance.name) ?? []).filter((n) => n !== i + 1)
        said.textContent = others.length ? `sings the same words as ${others.join(', ')}` : 'a name of its own: its own words'
      }
      say()
      name.addEventListener('input', () => {
        instance.name = name.value
        shares.clear()
        for (const [k, v] of sharing()) shares.set(k, v)
        for (const other of $('instances').querySelectorAll('.row')) other.dispatchEvent(new Event('say'))
        check()
      })
      li.addEventListener('say', say)
      const partSelect = el('select', { className: 'ipart' }, ...activeParts().map((p) => el('option', { value: p.id, textContent: p.id, selected: p.id === instance.part })))
      // a part not among the active ones (a file that names one) is still shown, as it is
      if (!activeParts().some((p) => p.id === instance.part)) partSelect.prepend(el('option', { value: instance.part, textContent: instance.part, selected: true }))
      partSelect.addEventListener('change', () => {
        instance.part = partSelect.value
        // another part has other parameters
        delete instance.parameters
        showRows()
        check()
      })
      const move = (by) => {
        const to = i + by
        if (to < 0 || to >= draft.instances.length) return
        ;[draft.instances[i], draft.instances[to]] = [draft.instances[to], draft.instances[i]]
        showRows()
        check()
      }
      const up = el('button', { type: 'button', className: 'up', textContent: '↑', title: 'earlier', disabled: i === 0 })
      const down = el('button', { type: 'button', className: 'down', textContent: '↓', title: 'later', disabled: i === draft.instances.length - 1 })
      const remove = el('button', { type: 'button', className: 'remove', textContent: 'Remove' })
      up.addEventListener('click', () => move(-1))
      down.addEventListener('click', () => move(1))
      remove.addEventListener('click', () => {
        draft.instances.splice(i, 1)
        showRows()
        check()
      })
      li.append(
        el('span', { className: 'n', textContent: i + 1 }),
        el('label', {}, 'Name ', name),
        said,
        el('label', {}, 'Part ', partSelect),
        up,
        down,
        remove,
        el('div', { className: 'params' }, ...(part ? part.parameters.map((definition) => paramControl(instance, definition)) : [])),
      )
      return li
    }),
  )
}

function edit(next) {
  draft = next
  $('editor').hidden = false
  showRows()
  check()
}

/** A name for a new instance of a part: its id and the next number nobody wears. */
function nameFor(part) {
  const worn = new Set(draft.instances.map(({ name }) => name))
  for (let n = 1; ; n++) if (!worn.has(`${part}-${n}`)) return `${part}-${n}`
}

$('copy').addEventListener('click', () => {
  const from = arrangements.find((a) => a.id === $('start').value)
  if (!from?.declaration) return
  const copy = structuredClone(from.declaration)
  copy.id = `${copy.id}-copy`
  copy.title = `${copy.title} (copy)`
  edit(copy)
})
$('empty').addEventListener('click', () => edit({ id: '', title: '', instances: [] }))
$('open').addEventListener('change', async (event) => {
  const [file] = event.target.files
  if (!file) return
  try {
    edit(JSON.parse(await file.text()))
  } catch (error) {
    $('editor').hidden = false
    $('verdict').className = 'verdict refused'
    $('verdict').textContent = `that file is not JSON: ${error.message}`
    $('save').disabled = true
  }
  event.target.value = ''
})
$('draft-id').addEventListener('input', () => {
  draft.id = $('draft-id').value
  check()
})
$('draft-title').addEventListener('input', () => {
  draft.title = $('draft-title').value
  check()
})
$('add').addEventListener('click', () => {
  const part = $('add-part').value
  if (!part) return
  draft.instances.push({ name: nameFor(part), part })
  showRows()
  check()
})
$('save').addEventListener('click', () => {
  if ($('save').disabled) return
  const link = el('a', { href: URL.createObjectURL(new Blob([serialize(draft)], { type: 'application/json' })), download: `${draft.id}.json` })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
})

// ---- loading

async function load() {
  const [partsJson, arrangementsJson] = await Promise.all([fetch('/parts.json').then((r) => r.json()), fetch(`/arrangements.json?tempo=${tempo()}`).then((r) => r.json())])
  parts = partsJson
  arrangements = arrangementsJson
  for (const select of [$('which'), $('start')]) {
    const before = select.value
    select.replaceChildren(...arrangements.map((a) => el('option', { value: a.id, textContent: a.title })))
    if (arrangements.some((a) => a.id === before)) select.value = before
  }
  $('add-part').replaceChildren(...activeParts().map((p) => el('option', { value: p.id, textContent: p.id })))
  showParts()
  showArrangement()
  // the draft a reload would have lost, if there was one
  if (!draft) {
    const kept = recalled()
    if (kept) edit(kept)
  } else {
    showRows()
    check()
  }
}

$('which').addEventListener('change', showArrangement)
$('tempo').addEventListener('change', load)
load()
