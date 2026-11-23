// The page of the Arrangements: the ones there are, drawn, and an editor for one at a time. It names no part, and repeats
// no rule: every rule about an Arrangement is the server's, asked at /check. The markup is static; everything the page
// shows comes from /parts.json, /arrangements.json and /check, built with textContent: the only innerHTML is the static
// markup below, which holds no data.

const arrangementMarkup = `
<section aria-labelledby="arrangements">
        <h2 id="arrangements">Arrangements</h2>
        <div class="controls">
          <label>Arrangement <select id="which"></select></label>
          <label>Tempo <input id="tempo" type="number" min="20" max="300" step="1" value="72" /> bpm</label>
          <span id="total" class="total"></span>
        </div>
        <p id="about" class="about"></p>
        <div class="scroll"><div id="diagram" class="diagram"></div></div>
        <ul class="key" id="key"></ul>
        <table class="order" id="order"></table>
      </section>

      <section aria-labelledby="edit">
        <h2 id="edit">Edit</h2>
        <p class="about">Start from a copy of an Arrangement, from nothing, or from a file. Every change is checked by the Composer, and an Arrangement it accepts can be saved as a file to put in the repository.</p>
        <div class="controls">
          <label>A copy of <select id="start"></select></label>
          <button id="copy" type="button">Copy it</button>
          <button id="empty" type="button">Start empty</button>
          <label class="file">Open a file <input id="open" type="file" accept=".json,application/json" /></label>
        </div>
        <div id="editor" hidden>
          <div class="controls fields">
            <label>Id <input id="draft-id" type="text" autocomplete="off" spellcheck="false" /></label>
            <label>Title <input id="draft-title" type="text" class="wide" autocomplete="off" /></label>
          </div>
          <ol id="instances" class="instances"></ol>
          <div class="controls">
            <label>Add a <select id="add-part"></select></label>
            <button id="add" type="button">Add</button>
          </div>
          <div id="verdict" class="verdict" role="status"></div>
          <div class="controls">
            <button id="save" type="button" disabled>Save as a file</button>
            <span id="edit-total" class="total"></span>
          </div>
          <div id="edit-view" class="view">
            <div class="scroll"><div id="edit-diagram" class="diagram"></div></div>
            <ul class="key" id="edit-key"></ul>
            <table class="order" id="edit-order"></table>
          </div>
        </div>
      </section>
`

function drawConcept(root) {
  root.innerHTML = arrangementMarkup
  let parts = []
  let arrangements = []

// ---- drawing a layout, in the viewer and in the editor

/** A letter for each of the things named, in the order they first appear: A to Z, then a to z. */
const lettersFor = (names) => {
  const letters = new Map()
  for (const name of names) if (!letters.has(name)) letters.set(name, String.fromCharCode((letters.size % 52 < 26 ? 65 : 71) + (letters.size % 52)))
  return letters
}

/** A letter for each region that has words, by index: regions of one name in one iteration share one, and a name after a turn has a letter of its own. */
function wordsLetters(layout) {
  const named = lettersFor(layout.instances.filter((instance) => instance.words === 'written').map((instance) => `${instance.iteration}:${instance.name}`))
  return new Map(layout.instances.filter((instance) => instance.words === 'written').map((instance) => [instance.index, named.get(`${instance.iteration}:${instance.name}`)]))
}

/** A clock's m:ss for a ruler's tick. */
const clock = (value) => `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`

/** Greedy sub-rows for the Blocks of one Track, so that two that overlap in time are not drawn on one another: each Block's row, from 0. */
function rowsOf(blocks) {
  const ends = []
  const rows = new Map()
  for (const block of [...blocks].sort((a, b) => a.startSeconds - b.startSeconds || a.index - b.index)) {
    let row = ends.findIndex((end) => end <= block.startSeconds + 1e-9)
    if (row < 0) row = ends.length
    ends[row] = block.endSeconds
    rows.set(block, row)
  }
  return rows
}

const labelWidth = 128
const rowHeight = 30

/**
 * Draws the timeline as a session is drawn: the ruler in seconds with the bars where there is a tempo, the regions coloured by part, a lane for the
 * tempo with free time drawn as free, a lane for each Track with its Blocks coloured by key (the same letter is the same sound, made once),
 * overlaps stacked and fades drawn as ramps. Everything it draws, the server worked out: `layout` for what a region is, `timeline` for where.
 */
function drawSession(layout, timeline, diagram, scroll) {
  if (!timeline || timeline.refusal) {
    diagram.replaceChildren(el('p', { className: 'about', textContent: timeline?.refusal ?? 'There is no timeline to draw.' }))
    return
  }
  // as wide as the page can read it, and no narrower than a second can be seen
  const room = scroll.clientWidth - labelWidth - 24
  const pps = Math.max(2.2, room / Math.max(1, timeline.seconds))
  const width = timeline.seconds * pps + 36
  const x = (value) => value * pps
  diagram.style.setProperty('--session', `${width}px`)
  diagram.style.width = `${labelWidth + width}px`

  const lane = (className, label, ...more) => {
    const canvas = el('div', { className: 'canvas' })
    canvas.style.width = `${width}px`
    return { canvas, row: el('div', { className: `lane ${className}` }, el('div', { className: 'label' }, ...label), canvas, ...more) }
  }
  const place = (node, from, to) => {
    node.style.left = `${x(from)}px`
    node.style.width = `${Math.max(1, x(to - from))}px`
    return node
  }

  // the ruler: ticks every so often, to a step that is far enough apart to read
  const ruler = lane('ruler', [el('span', { textContent: 'seconds' })])
  const step = [1, 2, 5, 10, 15, 30, 60, 120].find((candidate) => candidate * pps >= 64) ?? 120
  for (let t = 0; t <= timeline.seconds + 1e-9; t += step) ruler.canvas.append(Object.assign(el('span', { className: 'tick', textContent: clock(t) }), { style: `left:${x(t)}px` }))

  // the regions, coloured by part, the words that are sung more than once marked alike by a letter
  const letters = wordsLetters(layout)
  const regions = lane('regions', [el('span', { textContent: 'regions' })])
  for (const region of timeline.regions) {
    const instance = layout.instances[region.index]
    const box = place(el('div', { className: 'region' }), region.startSeconds, region.startSeconds + region.seconds)
    box.dataset.name = region.name
    box.style.background = colour(region.part)
    box.title = `${region.name}: a ${region.part}, from ${seconds(region.startSeconds)} for ${seconds(region.seconds)}${region.tempo === null ? ', in free time' : `, at ${region.tempo} beats a minute`}${instance?.grows ? `; ${growsWords}` : ''}`
    box.append(el('div', { className: 'name', textContent: region.name }), el('div', { className: 'what', textContent: `${region.part} · ${seconds(region.seconds)}` }))
    if (instance && instance.words === 'written') {
      const followed = instance.continues !== undefined ? layout.instances[instance.continues] : undefined
      box.append(el('div', { className: 'words', textContent: `${followed ? '↩ ' : ''}${letters.get(instance.index)}`, title: followed ? `Goes on with the words of region ${followed.index + 1}, which were sung before the turn` : 'The same letter, in the same iteration: the same words' }))
    }
    if (instance) box.append(el('span', { className: `end ${instance.ending}`, title: instance.ending === 'full' ? 'ends at home' : 'ends open, on the fifth' }))
    box.addEventListener('mouseenter', () => diagram.querySelectorAll('.region').forEach((other) => other.dataset.name === region.name && other.classList.add('lit')))
    box.addEventListener('mouseleave', () => diagram.querySelectorAll('.region').forEach((other) => other.classList.remove('lit')))
    regions.canvas.append(box)
  }

  // the tempo lane: a stretch under a tempo has its bars, a stretch in free time has none
  const tempoLane = lane('pace', [el('span', { textContent: 'tempo' })])
  for (const segment of timeline.segments) {
    const stretch = place(el('div', { className: segment.tempo === null ? 'stretch free' : 'stretch' }), segment.from, segment.to)
    const roomy = x(segment.to - segment.from) >= 120
    stretch.textContent = segment.tempo === null ? (roomy ? `free time · ${seconds(segment.to - segment.from)}` : 'free') : `${segment.tempo} bpm`
    stretch.title = segment.tempo === null ? 'No beat and no grid: this stretch lasts as long as it is given' : `${seconds(segment.to - segment.from)} under one tempo, its bars drawn`
    tempoLane.canvas.append(stretch)
    if (segment.tempo !== null) {
      const bar = (timeline.beatsPerBar * 60) / segment.tempo
      if (bar * pps >= 7) for (let t = segment.from; t < segment.to - 1e-9; t += bar) tempoLane.canvas.append(Object.assign(el('span', { className: 'bar' }), { style: `left:${x(t)}px` }))
    }
  }

  // the Tracks, a lane each, and on them the Blocks
  const keys = lettersFor(timeline.blocks.map((block) => block.key))
  const lanes = [ruler, regions, tempoLane]
  for (const track of timeline.tracks) {
    const mine = timeline.blocks.filter((block) => block.track === track.id)
    const rows = rowsOf(mine)
    const stacked = Math.max(1, ...[...rows.values()].map((row) => row + 1))
    const made = track.makes ? `${track.makes.by}, from ${track.makes.from}` : 'makes nothing yet'
    const one = lane(`track${track.makes ? '' : ' empty'}${track.heard ? '' : ' silent'}`, [el('strong', { textContent: track.title || track.id }), el('small', { textContent: track.heard ? made : `${made} · not heard` })])
    one.row.dataset.track = track.id
    one.canvas.style.height = `${stacked * rowHeight + 6}px`
    if (!track.makes) one.canvas.append(el('div', { className: 'nothing', textContent: 'nothing makes this yet: nothing is drawn' }))
    for (const block of mine) {
      const box = place(el('div', { className: 'clip' }), block.startSeconds, block.endSeconds)
      box.style.top = `${3 + rows.get(block) * rowHeight}px`
      box.style.background = colour(block.key)
      box.dataset.key = block.key
      box.title = `${block.key}: from ${seconds(block.startSeconds)} to ${seconds(block.endSeconds)}${block.gain !== 1 ? `, at gain ${block.gain}` : ''}${block.fadeIn ? `, fading in over ${seconds(block.fadeIn)}` : ''}${block.fadeOut ? `, fading out over ${seconds(block.fadeOut)}` : ''}${block.source.length ? `, made from ${block.source.join(', ')}` : ''}`
      box.append(el('span', { className: 'letter', textContent: keys.get(block.key) }), el('span', { className: 'source', textContent: block.source[0] ?? '' }))
      for (const [side, fade] of [['in', block.fadeIn], ['out', block.fadeOut]]) {
        if (!fade) continue
        const ramp = el('span', { className: `ramp ${side}` })
        ramp.style.width = `${Math.min(x(block.seconds), x(fade))}px`
        box.append(ramp)
      }
      box.addEventListener('mouseenter', () => diagram.querySelectorAll('.clip').forEach((other) => other.dataset.key === block.key && other.classList.add('lit')))
      box.addEventListener('mouseleave', () => diagram.querySelectorAll('.clip').forEach((other) => other.classList.remove('lit')))
      one.canvas.append(box)
    }
    lanes.push(one)
  }

  // where the words turn over, a line down through every lane
  const turns = timeline.turns.map(({ seconds: at, iteration }) => {
    const line = el('div', { className: 'turn', title: `The words turn over here: iteration ${iteration + 1} begins` }, el('span', { textContent: `turn → ${iteration + 1}` }))
    line.style.left = `${labelWidth + x(at)}px`
    return line
  })
  diagram.replaceChildren(...lanes.map(({ row }) => row), ...turns)
}

/** Draws a layout into a view: its timeline, its key and its table, and says how long it is. */
const drawn = new Map()

function draw(layout, timeline, views) {
  drawn.set(views, [layout, timeline])
  const { scroll, diagram, key, order, total } = views
  const length = timeline && !timeline.refusal ? timeline.seconds : layout.seconds
  const iterations = timeline && !timeline.refusal && timeline.iterations > 1 ? ` · ${timeline.iterations} iterations` : ''
  total.textContent = `${layout.instances.length} parts · ${seconds(length)}${iterations}`
  drawSession(layout, timeline, diagram, scroll)
  // the words that are sung more than once are marked alike, by a letter, in the order they first appear
  const letters = wordsLetters(layout)

  // the key: each part in its colour, and what the marks say
  const used = [...new Set(layout.instances.map((i) => i.part))]
  key.replaceChildren(
    ...used.map((id) => el('li', {}, Object.assign(el('span', { className: 'swatch' }), { style: `background:${colour(id)}` }), id)),
    el('li', {}, el('span', { className: 'end full' }), 'ends at home'),
    el('li', {}, el('span', { className: 'end' }), 'ends open'),
    el('li', {}, 'on a region, the same letter: the same words, within an iteration'),
    el('li', {}, '↩ on a region: it goes on with the words of the one it follows, across a turn'),
    el('li', {}, 'on a Block, the same letter: the same sound, made once'),
    el('li', {}, 'a ramp: a fade'),
    el('li', {}, 'a turn: the words turn over, and the Song is a number older'),
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
            : `${letters.get(i.index)}${i.heardAgain.length ? `, again at ${i.heardAgain.map((n) => n + 1).join(', ')}` : ', once'}${i.continues !== undefined ? `; goes on from ${i.continues + 1}` : ''}${i.grows ? `; ${growsWords}` : ''}`,
        ]),
      ),
    ),
  )
}

// as wide as the page can read it: drawn again when the page is a different width
let widthWas = window.innerWidth
window.addEventListener('resize', () => {
  if (window.innerWidth === widthWas) return
  widthWas = window.innerWidth
  for (const [views, [layout, timeline]] of drawn) drawSession(layout, timeline, views.diagram, views.scroll)
})

const viewer = { scroll: document.querySelector('#arrangements ~ .scroll'), diagram: $('diagram'), key: $('key'), order: $('order'), total: $('total') }
const editing = { scroll: document.querySelector('#edit-view .scroll'), diagram: $('edit-diagram'), key: $('edit-key'), order: $('edit-order'), total: $('edit-total') }

function showArrangement() {
  const chosen = arrangements.find((a) => a.id === $('which').value) ?? arrangements[0]
  if (!chosen) {
    viewer.diagram.replaceChildren()
    return
  }
  $('about').textContent = chosen.text
  draw(chosen.layout, chosen.timeline, viewer)
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
    lastGood = answer
    verdict.className = 'verdict accepted'
    verdict.textContent = 'This Arrangement is accepted.'
    $('save').disabled = false
    $('edit-view').classList.remove('dim')
    draw(answer.layout, answer.timeline, editing)
  } else {
    verdict.className = 'verdict refused'
    verdict.textContent = answer.refusal
    $('save').disabled = true
    // the last good drawing stays beneath, dimmed
    $('edit-view').classList.toggle('dim', Boolean(lastGood))
    if (lastGood) draw(lastGood.layout, lastGood.timeline, editing)
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
}
