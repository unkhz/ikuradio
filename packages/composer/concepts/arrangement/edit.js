// The Arrangement in Edit (plan "Evolution of Song", "Learn and Edit", step 12): its drawing, and beside it an inspector of fields for exact values.
// The shell (public/shell.js) is what every file's workspace shares: the picker, the unsaved mark, undo and redo, the check and Save. Here are only
// the fields of an Arrangement. It names no part and no Track: what there is, it is told by the Composer. Every rule is the server's, asked at /check.

const editMarkup = `
<div class="workspace">
  <section class="drawing" aria-label="The Arrangement, drawn">
    <div class="controls">
      <label>Tempo <input id="tempo" type="number" min="20" max="300" step="1" value="72" /> bpm</label>
      <span id="edit-total" class="total"></span>
    </div>
    <div id="edit-view" class="view">
      <div class="scroll"><div id="edit-diagram" class="diagram"></div></div>
      <details class="details">
        <summary>Details</summary>
        <ul class="key" id="edit-key"></ul>
        <table class="order" id="edit-order"></table>
      </details>
    </div>
  </section>
  <aside class="inspector" aria-label="The Arrangement, in fields">
    <div id="shell"></div>
    <div id="editor" hidden>
      <div class="controls fields">
        <label>Id <input id="draft-id" type="text" autocomplete="off" spellcheck="false" /></label>
        <label>Title <input id="draft-title" type="text" class="wide" autocomplete="off" /></label>
      </div>
      <h3>Regions</h3>
      <ol id="instances" class="instances"></ol>
      <div class="controls">
        <label>Add a <select id="add-part"></select></label>
        <button id="add" type="button">Add</button>
      </div>
      <h3>Tempo</h3>
      <ol id="tempo-points" class="rows"></ol>
      <div class="controls"><button id="add-tempo" type="button">Add a change of tempo</button></div>
      <h3>Turns</h3>
      <ol id="turn-points" class="rows"></ol>
      <div class="controls"><button id="add-turn" type="button">Add a turn</button></div>
      <h3>Tracks</h3>
      <div id="track-list" class="controls"></div>
      <h3>Blocks</h3>
      <ol id="blocks" class="rows"></ol>
      <div class="controls"><button id="add-block" type="button">Add a Block</button></div>
    </div>
  </aside>
</div>
`

function drawEdit(root, data) {
  root.innerHTML = editMarkup
  let parts = []
  let arrangements = data
  /** The last drawing the Composer accepted, kept dimmed beneath a refusal. */
  let lastGood
  const editing = { scroll: document.querySelector('#edit-view .scroll'), diagram: $('edit-diagram'), key: $('edit-key'), order: $('edit-order'), total: $('edit-total') }
  const tempo = () => Number($('tempo').value) || 72
  const activeParts = () => parts.filter((part) => part.state === 'active')

  const shell = editShell({
    noun: 'Arrangement',
    list: async () => arrangements.map(({ id, title }) => ({ id, title })),
    fetch: async (id) => arrangements.find((one) => one.id === id).declaration,
    blank: () => ({ id: '', title: '', instances: [] }),
    idOf: (draft) => draft.id,
    check: (draft) => fetch(`/check?tempo=${tempo()}`, { method: 'POST', body: JSON.stringify(draft) }).then((r) => r.json()),
    format: (draft) => fetch('/format', { method: 'POST', body: JSON.stringify(draft) }).then((r) => r.json()),
    render: () => {
      $('editor').hidden = false
      showRows()
    },
    checked: (answer) => showChecked(answer),
  })
  $('shell').append(shell.bar)

  // the check's answer, on the thing it is about: its row, and its field; and while it refuses, the last good drawing stays beneath, dimmed
  const things = { instance: '#instances .row', tempo: '#tempo-points .tempo-row', turn: '#turn-points .turn-row', block: '#blocks .block-row' }
  function showChecked(answer) {
    for (const old of document.querySelectorAll('#editor .why')) old.remove()
    for (const old of document.querySelectorAll('#editor .refused')) old.classList.remove('refused')
    if (answer.layout) {
      lastGood = answer
      $('edit-view').classList.remove('dim')
      draw(answer.layout, answer.timeline, editing)
      for (const row of document.querySelectorAll('#instances .row')) row.dispatchEvent(new Event('say'))
      return
    }
    $('edit-view').classList.toggle('dim', Boolean(lastGood))
    if (lastGood) draw(lastGood.layout, lastGood.timeline, editing)
    const where = answer.where
    if (!where) return
    const target = where.thing === 'arrangement' ? (where.field === 'tracks' ? $('track-list') : $(where.field === 'id' ? 'draft-id' : 'draft-title')?.closest('label')) : document.querySelectorAll(things[where.thing])[where.index]
    if (!target) return
    target.classList.add('refused')
    if (where.field) for (const control of target.querySelectorAll(`[data-field="${where.field}"], [data-field^="${where.field}-"]`)) control.classList.add('refused')
    target.append(el('div', { className: 'why', textContent: answer.refusal }))
  }

/** The names that more than one instance wears, with where they are worn, for the words beside a name. */
function sharing() {
  const where = new Map()
  shell.draft.instances.forEach((instance, i) => where.set(instance.name, [...(where.get(instance.name) ?? []), i + 1]))
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
    shell.changed()
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
  $('draft-id').value = shell.draft.id
  $('draft-title').value = shell.draft.title
  const shares = sharing()
  $('instances').replaceChildren(
    ...shell.draft.instances.map((instance, i) => {
      const part = parts.find((p) => p.id === instance.part)
      const li = el('li', { className: 'row' })
      li.style.setProperty('--colour', colour(instance.part))
      const name = el('input', { type: 'text', className: 'iname', value: instance.name, autocomplete: 'off', spellcheck: false })
      const said = el('span', { className: 'shares' })
      const say = () => {
        // as the Composer's layout says it, when it is of this draft: words are shared within an iteration only, and a name after a turn goes on with its own
        const placed = lastGood?.layout.instances
        const draftNames = shell.draft.instances
        if (placed && placed.length === draftNames.length && placed.every((one, k) => one.name === draftNames[k].name)) {
          const mine = placed[i]
          const bits = []
          if (mine.heardAgain.length) bits.push(`sings the same words as ${mine.heardAgain.map((n) => n + 1).join(', ')}`)
          if (mine.continues !== undefined) bits.push(`goes on with the words of ${mine.continues + 1}`)
          said.textContent = bits.length ? bits.join('; ') : 'a name of its own: its own words'
          return
        }
        const others = (shares.get(instance.name) ?? []).filter((n) => n !== i + 1)
        said.textContent = others.length ? `sings the same words as ${others.join(', ')}` : 'a name of its own: its own words'
      }
      say()
      name.addEventListener('input', () => {
        instance.name = name.value
        shares.clear()
        for (const [k, v] of sharing()) shares.set(k, v)
        for (const other of $('instances').querySelectorAll('.row')) other.dispatchEvent(new Event('say'))
        showTimeline()
        shell.changed()
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
        shell.changed()
      })
      const move = (by) => {
        const to = i + by
        if (to < 0 || to >= shell.draft.instances.length) return
        ;[shell.draft.instances[i], shell.draft.instances[to]] = [shell.draft.instances[to], shell.draft.instances[i]]
        showRows()
        shell.changed()
      }
      const up = el('button', { type: 'button', className: 'up', textContent: '↑', title: 'earlier', disabled: i === 0 })
      const down = el('button', { type: 'button', className: 'down', textContent: '↓', title: 'later', disabled: i === shell.draft.instances.length - 1 })
      const remove = el('button', { type: 'button', className: 'remove', textContent: 'Remove' })
      up.addEventListener('click', () => move(-1))
      down.addEventListener('click', () => move(1))
      remove.addEventListener('click', () => {
        shell.draft.instances.splice(i, 1)
        showRows()
        shell.changed()
      })
      const secondsInput = numberInput(instance.seconds, { min: 0, className: 'short', placeholder: 'none' })
      secondsInput.dataset.field = 'seconds'
      secondsInput.addEventListener('input', () => {
        setOrDrop(instance, 'seconds', secondsInput.value === '' ? '' : Number(secondsInput.value))
        shell.changed()
      })
      const endingSelect = el('select', {}, el('option', { value: '', textContent: "as the part's" }), el('option', { value: 'full', textContent: 'at home' }), el('option', { value: 'half', textContent: 'open' }))
      endingSelect.value = instance.ending ?? ''
      endingSelect.dataset.field = 'ending'
      endingSelect.addEventListener('change', () => {
        setOrDrop(instance, 'ending', endingSelect.value)
        shell.changed()
      })
      li.append(
        el('span', { className: 'n', textContent: i + 1 }),
        el('label', {}, 'Name ', name),
        said,
        el('label', {}, 'Part ', partSelect),
        el('label', {}, 'Seconds ', secondsInput),
        el('label', {}, 'Ends ', endingSelect),
        up,
        down,
        remove,
        el('div', { className: 'params' }, ...(part ? part.parameters.map((definition) => paramControl(instance, definition)) : [])),
      )
      return li
    }),
  )
  showTimeline()
}

// ---- the timeline in the editor: tempo, turns, tracks and Blocks

/** The Tracks there are, as the Composer lists them. */
let tracksThere = []

/** A field that is given or left out: an empty one is not written. */
function setOrDrop(object, key, value) {
  if (value === '' || value === undefined || Number.isNaN(value)) delete object[key]
  else object[key] = value
}

/** The list a draft keeps for a timeline field, dropped when it is empty (a file with an empty list is refused). */
function tidy(field) {
  if (shell.draft[field] && !shell.draft[field].length) delete shell.draft[field]
}

const names = () => [...new Set(shell.draft.instances.map(({ name }) => name))]

/** A select of the regions' names, with a first choice for none, and the value shown even if it names a region that is gone. */
function regionSelect(value, none) {
  const options = names()
  if (value !== undefined && !options.includes(value)) options.push(value)
  const select = el('select', {}, el('option', { value: '', textContent: none }), ...options.map((name) => el('option', { value: name, textContent: name })))
  select.value = value ?? ''
  return select
}

const numberInput = (value, props = {}) => el('input', { type: 'number', step: 'any', value: value ?? '', ...props })

/** An anchor's controls: the region (or the whole Song), which hearing of it, its start or end, and so many seconds beyond. */
function anchorControls(anchor, kind, none, change) {
  const region = regionSelect(anchor.region, none)
  region.dataset.field = `${kind}-region`
  const hearing = numberInput(anchor.hearing, { min: 1, step: 1, placeholder: 'once', className: 'short' })
  hearing.dataset.field = `${kind}-hearing`
  const edge = el('select', {}, el('option', { value: 'start', textContent: 'start' }), el('option', { value: 'end', textContent: 'end' }))
  edge.value = anchor.edge ?? 'start'
  edge.dataset.field = `${kind}-edge`
  const plus = numberInput(anchor.plus, { placeholder: '0', className: 'short' })
  plus.dataset.field = `${kind}-plus`
  const settle = () => {
    setOrDrop(anchor, 'region', region.value)
    setOrDrop(anchor, 'hearing', hearing.value === '' ? '' : Number(hearing.value))
    anchor.edge = edge.value
    setOrDrop(anchor, 'plus', plus.value === '' || Number(plus.value) === 0 ? '' : Number(plus.value))
    change()
  }
  for (const control of [region, hearing, edge, plus]) control.addEventListener('input', settle)
  return el('span', { className: 'anchor' }, region, el('label', {}, ' heard ', hearing), ' ', edge, el('label', {}, ' plus ', plus, ' s'))
}

const rowButtons = (list, i, redraw) => {
  const move = (by) => {
    const to = i + by
    if (to < 0 || to >= list.length) return
    ;[list[i], list[to]] = [list[to], list[i]]
    redraw()
    shell.changed()
  }
  const up = el('button', { type: 'button', className: 'up', textContent: '↑', title: 'earlier', disabled: i === 0 })
  const down = el('button', { type: 'button', className: 'down', textContent: '↓', title: 'later', disabled: i === list.length - 1 })
  const remove = el('button', { type: 'button', className: 'remove', textContent: 'Remove' })
  up.addEventListener('click', () => move(-1))
  down.addEventListener('click', () => move(1))
  remove.addEventListener('click', () => {
    list.splice(i, 1)
    redraw()
    shell.changed()
  })
  return [up, down, remove]
}

function showTempo() {
  const points = shell.draft.tempo ?? []
  $('tempo-points').replaceChildren(
    ...points.map((point, i) => {
      const where = regionSelect(point.region, 'the start of the Song')
      where.dataset.field = 'region'
      const hearing = numberInput(point.hearing, { min: 1, step: 1, placeholder: 'once', className: 'short' })
      hearing.dataset.field = 'hearing'
      const mode = el('select', {}, el('option', { value: 'mood', textContent: "the Mood's" }), el('option', { value: 'number', textContent: 'a number' }), el('option', { value: 'free', textContent: 'free time' }))
      mode.dataset.field = 'mode'
      const bpm = numberInput(typeof point.bpm === 'number' ? point.bpm : '', { min: 20, max: 300, className: 'short' })
      bpm.dataset.field = 'bpm'
      mode.value = point.bpm === 'mood' ? 'mood' : point.bpm === null ? 'free' : 'number'
      bpm.hidden = mode.value !== 'number'
      const settle = () => {
        setOrDrop(point, 'region', where.value)
        setOrDrop(point, 'hearing', hearing.value === '' ? '' : Number(hearing.value))
        point.bpm = mode.value === 'mood' ? 'mood' : mode.value === 'free' ? null : Number(bpm.value)
        bpm.hidden = mode.value !== 'number'
        shell.changed()
      }
      for (const control of [where, hearing, mode, bpm]) control.addEventListener('input', settle)
      return el('li', { className: 'row tempo-row' }, el('span', { className: 'n', textContent: i + 1 }), el('label', {}, 'From ', where), el('label', {}, ' heard ', hearing), el('label', {}, ' at ', mode), bpm, ...rowButtons(shell.draft.tempo, i, () => { tidy('tempo'); showTempo() }))
    }),
  )
}

function showTurns() {
  const turns = shell.draft.turns ?? []
  $('turn-points').replaceChildren(
    ...turns.map((turn, i) => el('li', { className: 'row turn-row' }, el('span', { className: 'n', textContent: i + 1 }), el('span', { textContent: 'The words turn over at the ' }), anchorControls(turn, 'turn', 'Song', () => shell.changed()), ...rowButtons(shell.draft.turns, i, () => { tidy('turns'); showTurns() }))),
  )
}

function showTracks() {
  const listed = shell.draft.tracks ?? []
  $('track-list').replaceChildren(
    ...tracksThere.map((track) => {
      const box = el('input', { type: 'checkbox', checked: listed.includes(track.id) })
      box.dataset.track = track.id
      box.addEventListener('change', () => {
        const kept = tracksThere.filter((other) => (other.id === track.id ? box.checked : (shell.draft.tracks ?? []).includes(other.id))).map((other) => other.id)
        if (kept.length) shell.draft.tracks = kept
        else delete shell.draft.tracks
        showBlocks()
        shell.changed()
      })
      return el('label', { title: track.makes ? `${track.makes.by}, from ${track.makes.from}` : 'nothing makes it yet' }, box, ` ${track.title || track.id}`)
    }),
  )
}

function showBlocks() {
  const blocks = shell.draft.blocks ?? []
  const lanes = shell.draft.tracks?.length ? shell.draft.tracks : tracksThere.map((track) => track.id)
  $('blocks').replaceChildren(
    ...blocks.map((block, i) => {
      const track = el('select', {}, ...[...new Set([...lanes, block.track])].filter(Boolean).map((id) => el('option', { value: id, textContent: id })))
      track.value = block.track ?? ''
      track.dataset.field = 'track'
      const key = el('input', { type: 'text', value: block.key ?? '', className: 'iname', autocomplete: 'off', spellcheck: false })
      key.dataset.field = 'key'
      const source = el('input', { type: 'text', value: (block.source ?? []).join(', '), className: 'iname', autocomplete: 'off', spellcheck: false, placeholder: 'regions' })
      source.dataset.field = 'source'
      const gives = tracksThere.find((one) => one.id === block.track)?.parameters ?? ['gain', 'fadeIn', 'fadeOut']
      const given = gives.map((name) => {
        const input = numberInput(block[name], { className: 'short' })
        input.dataset.field = name
        input.addEventListener('input', () => {
          setOrDrop(block, name, input.value === '' ? '' : Number(input.value))
          shell.changed()
        })
        return el('label', {}, ` ${name} `, input)
      })
      track.addEventListener('change', () => {
        block.track = track.value
        showBlocks()
        shell.changed()
      })
      key.addEventListener('input', () => {
        block.key = key.value
        shell.changed()
      })
      source.addEventListener('input', () => {
        const regions = source.value.split(',').map((name) => name.trim()).filter(Boolean)
        if (regions.length) block.source = regions
        else delete block.source
        shell.changed()
      })
      return el(
        'li',
        { className: 'row block-row' },
        el('span', { className: 'n', textContent: i + 1 }),
        el('label', {}, 'On ', track),
        el('label', {}, ' key ', key),
        el('div', { className: 'params' }, el('span', {}, 'from ', anchorControls(block.from, 'from', 'the Song', () => shell.changed())), el('span', {}, 'to ', anchorControls(block.to, 'to', 'the Song', () => shell.changed())), el('label', {}, 'made from ', source), ...given),
        ...rowButtons(shell.draft.blocks, i, () => { tidy('blocks'); showBlocks() }),
      )
    }),
  )
}

function showTimeline() {
  showTempo()
  showTurns()
  showTracks()
  showBlocks()
}

$('add-tempo').addEventListener('click', () => {
  shell.draft.tempo = [...(shell.draft.tempo ?? []), { bpm: 'mood' }]
  showTempo()
  shell.changed()
})
$('add-turn').addEventListener('click', () => {
  shell.draft.turns = [...(shell.draft.turns ?? []), { edge: 'start' }]
  showTurns()
  shell.changed()
})
$('add-block').addEventListener('click', () => {
  const lanes = shell.draft.tracks?.length ? shell.draft.tracks : tracksThere.map((track) => track.id)
  shell.draft.blocks = [...(shell.draft.blocks ?? []), { track: lanes[0] ?? '', key: '', from: { edge: 'start' }, to: { edge: 'end' } }]
  showBlocks()
  shell.changed()
})

/** A name for a new instance of a part: its id and the next number nobody wears. */
function nameFor(part) {
  const worn = new Set(shell.draft.instances.map(({ name }) => name))
  for (let n = 1; ; n++) if (!worn.has(`${part}-${n}`)) return `${part}-${n}`
}

$('draft-id').addEventListener('input', () => {
  shell.draft.id = $('draft-id').value
  shell.changed()
})
$('draft-title').addEventListener('input', () => {
  shell.draft.title = $('draft-title').value
  shell.changed()
})
$('add').addEventListener('click', () => {
  const part = $('add-part').value
  if (!part) return
  shell.draft.instances.push({ name: nameFor(part), part })
  showRows()
  shell.changed()
})

  async function load() {
    const [partsJson, arrangementsJson, tracksJson] = await Promise.all([fetch('/parts.json').then((r) => r.json()), fetch('/arrangements.json').then((r) => r.json()), fetch('/tracks.json').then((r) => r.json())])
    parts = partsJson
    tracksThere = tracksJson
    arrangements = arrangementsJson
    $('add-part').replaceChildren(...activeParts().map((p) => el('option', { value: p.id, textContent: p.id })))
    await shell.load()
  }

  $('tempo').addEventListener('change', () => shell.draft && shell.changed())
  load()
}
