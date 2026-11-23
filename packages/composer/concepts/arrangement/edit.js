// The Arrangement in Edit (plan "Evolution of Song", "Learn and Edit", step 12): its drawing, and beside it an inspector of fields for exact values.
// The shell (public/shell.js) is what every file's workspace shares: the picker, the unsaved mark, undo and redo, the check and Save. Here are only
// the fields of an Arrangement. It names no part and no Track: what there is, it is told by the Composer. Every rule is the server's, asked at /check.

const editMarkup = `
<div id="shell"></div>
<section class="drawing" aria-label="The Arrangement, drawn">
  <div class="controls">
    <label>Tempo <input id="tempo" type="number" min="20" max="300" step="1" value="72" /> bpm</label>
    <label>Zoom <input id="zoom" type="range" min="1" max="16" step="0.25" value="1" /></label>
    <button id="fit" type="button" title="Fit the whole Song to the window">Fit</button>
    <span id="edit-total" class="total"></span>
    <span id="hint" class="hint"></span>
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
<div id="editor" class="inspector" aria-label="Inspector" hidden>
  <section class="selected-panel">
    <h3>Chosen <button id="list-toggle" type="button" class="quiet" aria-pressed="false" title="Show every region, change of tempo, turn and Block as rows">List</button></h3>
    <p id="nothing-chosen" class="about"></p>
    <div id="chosen-extras" class="chosen-extras"></div>
    <ol id="instances" class="instances"></ol>
    <ol id="tempo-points" class="rows"></ol>
    <ol id="turn-points" class="rows"></ol>
    <ol id="blocks" class="rows"></ol>
  </section>
  <section class="file-panel">
    <h3>The Arrangement</h3>
    <div class="controls fields">
      <label>Id <input id="draft-id" type="text" autocomplete="off" spellcheck="false" /></label>
      <label>Title <input id="draft-title" type="text" class="wide" autocomplete="off" /></label>
    </div>
    <h3>Tracks</h3>
    <div id="track-list" class="controls"></div>
    <h3>Add</h3>
    <div class="controls">
      <label>A region <select id="add-part"></select></label>
      <button id="add" type="button">Add</button>
    </div>
    <div class="controls">
      <button id="add-tempo" type="button">A change of tempo</button>
      <button id="add-turn" type="button">A turn</button>
      <button id="add-block" type="button">A Block</button>
    </div>
  </section>
</div>
`

function drawEdit(root, data) {
  root.innerHTML = editMarkup
  let parts = []
  let arrangements = data
  /** The last drawing the Composer accepted, kept dimmed beneath a refusal. */
  let lastGood
  /** What is chosen on the drawing: { kind: 'region' | 'tempo' | 'turn' | 'block', index }, or nothing. It is part of every step undo and redo go to. */
  let selection = null
  /** Whether the inspector lists every row, and not only the chosen. */
  let listMode = false
  let zoom = 1
  /** While on, a click on a region adds it to, or takes it from, what the chosen Block is made from. */
  let pickingSource = false
  /** What the last refusal was about, to be shown on the drawing as it is in the inspector. */
  let refusedWhere = null
  const editing = {
    scroll: document.querySelector('#edit-view .scroll'),
    diagram: $('edit-diagram'),
    key: $('edit-key'),
    order: $('edit-order'),
    total: $('edit-total'),
    edit: () => ({ zoom, selection, refused: refusedWhere, tempoPoints: pointsOf(), turnBoundaries: turnsOf() }),
  }
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
    extra: () => (selection ? { ...selection } : null),
    restore: (kept) => {
      selection = kept ? { ...kept } : null
      pickingSource = false
    },
    render: () => {
      $('editor').hidden = false
      showRows()
    },
    checked: (answer) => showChecked(answer),
  })
  $('shell').append(shell.bar)

  /** The rows an inspector shows: the chosen one, or every one in the list. */
  const kindOf = { instance: 'region', region: 'region', tempo: 'tempo', turn: 'turn', block: 'block' }
  const shown = (kind, rows) => rows.filter((row) => listMode || (selection?.kind === kind && selection.index === Number(row.dataset.index)))

  /** The selection changes, without the draft: the drawing and the inspector follow, and the step undo is at remembers it. */
  function select(next) {
    selection = next
    pickingSource = false
    showRows()
    redrawSession()
    shell.remember()
  }
  function redrawSession() {
    if (lastGood) draw(lastGood.layout, lastGood.timeline, editing)
  }

  // the check's answer, on the thing it is about: its row, its field, and its place on the drawing; while it refuses, the last good drawing stays beneath, dimmed
  const things = { instance: '#instances > li', tempo: '#tempo-points > li', turn: '#turn-points > li', block: '#blocks > li' }
  function showChecked(answer) {
    for (const old of document.querySelectorAll('#editor .why')) old.remove()
    for (const old of document.querySelectorAll('#editor .refused')) old.classList.remove('refused')
    refusedWhere = answer.refusal ? answer.where ?? null : null
    if (answer.layout) {
      lastGood = answer
      $('edit-view').classList.remove('dim')
      draw(answer.layout, answer.timeline, editing)
      for (const row of document.querySelectorAll('#instances .row')) row.dispatchEvent(new Event('say'))
      return
    }
    $('edit-view').classList.toggle('dim', Boolean(lastGood))
    redrawSession()
    const where = answer.where
    if (!where) return
    const target =
      where.thing === 'arrangement'
        ? where.field === 'tracks'
          ? $('track-list')
          : $(where.field === 'id' ? 'draft-id' : 'draft-title')?.closest('label')
        : document.querySelector(`${things[where.thing]}[data-index="${where.index}"]`)
    if (!target) {
      // the thing is not among the rows shown: the words are in the verdict above, and the drawing marks the thing
      return
    }
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
    ...shown('region', shell.draft.instances.map((instance, i) => {
      const part = parts.find((p) => p.id === instance.part)
      const li = el('li', { className: 'row' })
      li.dataset.index = i
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
    })),
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
  const hearing = numberInput(anchor.hearing, { min: 1, step: 1, placeholder: 'first', title: 'Which time it is heard; empty is the first hearing', className: 'short' })
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

/** Earlier, later and remove for a row of a list the draft keeps: what is chosen goes with the row, or goes. */
const rowButtons = (kind, field, i) => {
  const list = shell.draft[field]
  const refresh = () => {
    tidy(field)
    settleSeconds()
    showTimeline()
    redrawSession()
    shell.changed()
  }
  const move = (by) => {
    const to = i + by
    if (to < 0 || to >= list.length) return
    ;[list[i], list[to]] = [list[to], list[i]]
    if (selection?.kind === kind && selection.index === i) selection = { kind, index: to }
    refresh()
  }
  const up = el('button', { type: 'button', className: 'up', textContent: '↑', title: 'earlier', disabled: i === 0 })
  const down = el('button', { type: 'button', className: 'down', textContent: '↓', title: 'later', disabled: i === list.length - 1 })
  const remove = el('button', { type: 'button', className: 'remove', textContent: 'Remove' })
  up.addEventListener('click', () => move(-1))
  down.addEventListener('click', () => move(1))
  remove.addEventListener('click', () => {
    list.splice(i, 1)
    if (selection?.kind === kind) selection = selection.index === i ? null : selection.index > i ? { kind, index: selection.index - 1 } : selection
    refresh()
  })
  return [up, down, remove]
}

function showTempo() {
  const points = shell.draft.tempo ?? []
  $('tempo-points').replaceChildren(
    ...shown(
      'tempo',
      points.map((point, i) => {
        const where = regionSelect(point.region, 'the start of the Song')
        where.dataset.field = 'region'
        const hearing = numberInput(point.hearing, { min: 1, step: 1, placeholder: 'first', title: 'Which time it is heard; empty is the first hearing', className: 'short' })
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
          settleSeconds()
          redrawSession()
          shell.changed()
        }
        for (const control of [where, hearing, mode, bpm]) control.addEventListener('input', settle)
        const li = el('li', { className: 'row tempo-row' }, el('span', { className: 'n', textContent: i + 1 }), el('label', {}, 'From ', where), el('label', {}, ' heard ', hearing), el('label', {}, ' at ', mode), bpm, ...rowButtons('tempo', 'tempo', i))
        li.dataset.index = i
        return li
      }),
    ),
  )
}

function showTurns() {
  const turns = shell.draft.turns ?? []
  $('turn-points').replaceChildren(
    ...shown(
      'turn',
      turns.map((turn, i) => {
        const li = el('li', { className: 'row turn-row' }, el('span', { className: 'n', textContent: i + 1 }), el('span', { textContent: 'The words turn over at the ' }), anchorControls(turn, 'turn', 'Song', () => { redrawSession(); shell.changed() }), ...rowButtons('turn', 'turns', i))
        li.dataset.index = i
        return li
      }),
    ),
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
    ...shown(
      'block',
      blocks.map((block, i) => {
        const track = el('select', {}, ...[...new Set([...lanes, block.track])].filter(Boolean).map((id) => el('option', { value: id, textContent: id })))
        track.value = block.track ?? ''
        track.dataset.field = 'track'
        const key = el('input', { type: 'text', value: block.key ?? '', className: 'iname', autocomplete: 'off', spellcheck: false })
        key.dataset.field = 'key'
        // the keys already on its Track, to pick from: the same key is the same sound, heard again
        const onTrack = [...new Set(blocks.filter((other) => other.track === block.track && other.key).map((other) => other.key))]
        const pick = el('select', { title: 'A key already on this Track' }, el('option', { value: '', textContent: 'a key on this Track…' }), ...onTrack.map((one) => el('option', { value: one, textContent: one })))
        pick.dataset.field = 'key-pick'
        pick.addEventListener('change', () => {
          if (!pick.value) return
          block.key = pick.value
          // one key, one sound: made from one thing
          const same = blocks.find((other) => other !== block && other.key === pick.value && other.source)
          if (same?.source) block.source = [...same.source]
          showBlocks()
          redrawSession()
          shell.changed()
        })
        const unique = el('button', { type: 'button', className: 'unique', textContent: 'Make unique', title: 'Give this Block a key of its own: a sound of its own' })
        unique.addEventListener('click', () => {
          block.key = uniqueKey(block.key || block.track || 'block', block)
          showBlocks()
          redrawSession()
          shell.changed()
        })
        const source = el('input', { type: 'text', value: (block.source ?? []).join(', '), className: 'iname', autocomplete: 'off', spellcheck: false, placeholder: 'regions' })
        source.dataset.field = 'source'
        const picking = el('button', { type: 'button', className: 'pick-source', textContent: pickingSource ? 'Done choosing' : 'Choose on the drawing', 'aria-pressed': String(pickingSource) })
        picking.addEventListener('click', () => {
          pickingSource = !pickingSource
          showBlocks()
          hint()
        })
        const gives = tracksThere.find((one) => one.id === block.track)?.parameters ?? []
        const given = gives.map(({ name, minimum, maximum }) => {
          const input = numberInput(block[name], { className: 'short', min: minimum, max: maximum, title: humanParameter(name, maximum).title })
          input.dataset.field = name
          input.addEventListener('input', () => {
            setOrDrop(block, name, input.value === '' ? '' : Number(input.value))
            redrawSession()
            shell.changed()
          })
          return el('label', {}, ` ${humanParameter(name, maximum).label} `, input)
        })
        track.addEventListener('change', () => {
          block.track = track.value
          showBlocks()
          redrawSession()
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
        const li = el(
          'li',
          { className: 'row block-row' },
          el('span', { className: 'n', textContent: i + 1 }),
          el('label', {}, 'On ', track),
          el('label', {}, ' key ', key),
          pick,
          unique,
          el(
            'div',
            { className: 'params' },
            el('span', {}, 'from ', anchorControls(block.from, 'from', 'the Song', () => { redrawSession(); shell.changed() })),
            el('span', {}, 'to ', anchorControls(block.to, 'to', 'the Song', () => { redrawSession(); shell.changed() })),
            el('label', {}, 'made from ', source, ' ', picking),
            ...given,
          ),
          ...rowButtons('block', 'blocks', i),
        )
        li.dataset.index = i
        return li
      }),
    ),
  )
}

/** What a Block's parameter is called to a person, with its unit; the file's own name stays what it is. */
function humanParameter(name, maximum) {
  if (name === 'fadeIn') return { label: 'fade in (s)', title: 'Seconds the sound takes to come in' }
  if (name === 'fadeOut') return { label: 'fade out (s)', title: 'Seconds the sound takes to go out' }
  if (name === 'gain') return { label: `gain (0 to ${maximum ?? 2})`, title: 'How loud it is laid: 1 is as made' }
  return { label: name, title: name }
}

/** A key like this one that no other Block has. */
function uniqueKey(base, block = null) {
  const worn = new Set((shell.draft.blocks ?? []).filter((other) => other !== block).map((other) => other.key))
  const stem = base.replace(/:\d+$/, '')
  for (let n = 2; ; n++) if (!worn.has(`${stem}:${n}`)) return `${stem}:${n}`
}

function showTimeline() {
  showTempo()
  showTurns()
  showTracks()
  showBlocks()
  showChosenExtras()
}

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

// ---- adding by button, as well as on the drawing: the new thing is chosen, so that the inspector shows it

$('add').addEventListener('click', () => {
  const part = $('add-part').value
  if (!part) return
  shell.draft.instances.push({ name: nameFor(part), part })
  selection = { kind: 'region', index: shell.draft.instances.length - 1 }
  showRows()
  shell.changed()
})
$('add-tempo').addEventListener('click', () => {
  shell.draft.tempo = [...(shell.draft.tempo ?? []), { bpm: 'mood' }]
  selection = { kind: 'tempo', index: shell.draft.tempo.length - 1 }
  showTimeline()
  shell.changed()
})
$('add-turn').addEventListener('click', () => {
  shell.draft.turns = [...(shell.draft.turns ?? []), { edge: 'start' }]
  selection = { kind: 'turn', index: shell.draft.turns.length - 1 }
  showTimeline()
  shell.changed()
})
$('add-block').addEventListener('click', () => {
  const lanes = shell.draft.tracks?.length ? shell.draft.tracks : tracksThere.map((track) => track.id)
  shell.draft.blocks = [...(shell.draft.blocks ?? []), { track: lanes[0] ?? '', key: '', from: { edge: 'start' }, to: { edge: 'end' } }]
  selection = { kind: 'block', index: shell.draft.blocks.length - 1 }
  showTimeline()
  shell.changed()
})
$('list-toggle').addEventListener('click', () => {
  listMode = !listMode
  $('list-toggle').setAttribute('aria-pressed', String(listMode))
  showRows()
})

// ---- what the drawing says of the draft: where its tempo changes and its turns are, from the names of its regions

const namesNow = () => shell.draft.instances.map(({ name }) => name)

function pointsOf() {
  const names = namesNow()
  return (shell.draft?.tempo ?? []).flatMap((point, index) => {
    const at = point.region === undefined ? 0 : regionIndexOf(names, point.region, point.hearing)
    return at === undefined ? [] : [{ index, at, bpm: point.bpm }]
  })
}
function turnsOf() {
  const names = namesNow()
  return (shell.draft?.turns ?? []).flatMap((turn, index) => {
    const at = turn.region === undefined ? undefined : boundaryOf(names, turn)
    return at ? [{ index, boundary: at.boundary }] : []
  })
}

/** A region in free time has the seconds it was given: one that has gone into free time is given the length it had, and one that has left it gives them up. */
function settleSeconds() {
  const names = namesNow()
  const under = tempoUnder(names, shell.draft.tempo)
  const was = lastGood?.timeline?.regions
  shell.draft.instances.forEach((instance, r) => {
    if (under[r] === null) {
      if (instance.seconds === undefined) instance.seconds = Math.max(1, Math.round(was?.[r]?.seconds ?? 10))
    } else if (instance.seconds !== undefined) delete instance.seconds
  })
}

/** What the inspector says beside the rows: that nothing is chosen, and what a chosen region may have added after it. */
function showChosenExtras() {
  const extras = $('chosen-extras')
  $('nothing-chosen').textContent = !selection && !listMode ? 'Click a region, a Block, a change of tempo or a turn on the drawing to choose it. Drag on a Track to draw a Block.' : ''
  extras.replaceChildren()
  if (selection?.kind === 'region' && !listMode) {
    const part = el('select', { id: 'add-after-part' }, ...activeParts().map((p) => el('option', { value: p.id, textContent: p.id })))
    const add = el('button', { id: 'add-after', type: 'button', textContent: 'Add a region after it' })
    add.addEventListener('click', () => {
      const index = selection.index + 1
      shell.draft.instances.splice(index, 0, { name: nameFor(part.value), part: part.value })
      selection = { kind: 'region', index }
      showRows()
      shell.changed()
    })
    extras.append(el('div', { className: 'controls' }, part, add))
  }
  hint()
}

function hint() {
  $('hint').textContent = pickingSource
    ? 'Click regions to choose what the Block is made from · Esc to finish'
    : selection
      ? 'Del removes it · arrows nudge it · Esc lets go'
      : 'Click to choose · drag to move or stretch · drag on a Track to draw · Alt-drag copies · Shift: no snapping · double-click the ruler for a turn'
}

// ---- the mouse

const timelineNow = () => (lastGood && !lastGood.timeline.refusal ? lastGood.timeline : undefined)
const ppsNow = () => Number(editing.diagram.dataset.pps) || 1
const originX = () => editing.diagram.querySelector('.canvas')?.getBoundingClientRect().left ?? 0
const secondsAt = (clientX) => (clientX - originX()) / ppsNow()
const snapRadius = () => 8 / ppsNow()
const regionAt = (tl, t) => {
  const found = tl.regions.findIndex((region) => t >= region.startSeconds && t < region.startSeconds + region.seconds)
  return found < 0 ? (t < 0 ? 0 : tl.regions.length - 1) : found
}

let labelBox
function showLabel(text, event) {
  if (!labelBox) {
    labelBox = el('div', { className: 'drag-label' })
    document.body.append(labelBox)
  }
  labelBox.textContent = text
  // kept inside the window: on the other side of the pointer near the right edge, and below it near the top
  const room = labelBox.offsetWidth + 20
  labelBox.style.left = `${event.clientX + room > window.innerWidth ? Math.max(4, event.clientX - room + 6) : event.clientX + 14}px`
  labelBox.style.top = `${event.clientY < 40 ? event.clientY + 18 : event.clientY - 30}px`
}
function hideLabel() {
  labelBox?.remove()
  labelBox = undefined
}

/** A line where a region or a turn would be put down. */
function dropMarker(tl, boundary) {
  for (const old of editing.diagram.querySelectorAll('.drop-marker')) old.remove()
  if (boundary === undefined) return
  const at = boundary < tl.regions.length ? tl.regions[boundary].startSeconds : tl.seconds
  const line = el('div', { className: 'drop-marker' })
  line.style.left = `${Number(editing.diagram.dataset.label) + at * ppsNow()}px`
  editing.diagram.append(line)
}

/** The key a new Block is given, from what it covers, and what it is made from: the first region it covers. One key is one sound, made from one thing. */
function newBlock(track, tl, from, to, startSeconds, endSeconds) {
  const covered = [...new Set(coveredBy(tl, startSeconds, endSeconds))]
  const base = `${track}:${covered.join(':and:') || 'block'}`
  const sameSource = covered[0] ? [covered[0]] : undefined
  const clash = (shell.draft.blocks ?? []).some((other) => other.key === base && JSON.stringify(other.source ?? []) !== JSON.stringify(sameSource ?? []))
  const block = { track, key: clash ? uniqueKey(base) : base, from, to }
  if (sameSource) block.source = sameSource
  return block
}

let drag = null
const still = 3

editing.diagram.addEventListener('pointerdown', (event) => {
  const tl = timelineNow()
  if (event.button !== 0 || !tl || event.target.closest('input, select, button')) return
  const target = event.target
  const clip = target.closest('.clip')
  const region = target.closest('.region')
  const flag = target.closest('.point')
  const turn = target.closest('.turn-handle')
  const canvas = target.closest('.canvas')
  const base = { startX: event.clientX, startY: event.clientY, moved: false, pointerId: event.pointerId }
  if (clip) {
    const index = Number(clip.dataset.block)
    const rect = clip.getBoundingClientRect()
    const what = target.dataset.grip ? { type: 'stretch', side: target.dataset.grip } : target.dataset.fade ? { type: 'fade', name: target.dataset.fade } : target.dataset.gain ? { type: 'gain' } : { type: 'move-block' }
    drag = { ...base, ...what, index, clip, rect }
  } else if (region) {
    const index = Number(region.dataset.index)
    const free = tl.regions[index].tempo === null
    const rect = region.getBoundingClientRect()
    drag = { ...base, type: free && event.clientX > rect.right - 8 ? 'seconds' : 'move-region', index, box: region, rect }
  } else if (flag) {
    drag = { ...base, type: 'move-point', index: Number(flag.dataset.point), flag }
  } else if (turn) {
    drag = { ...base, type: 'move-turn', index: Number(turn.dataset.turn), flag: turn }
  } else if (canvas?.dataset.lane === 'track') {
    drag = { ...base, type: 'draw', track: canvas.dataset.track, canvas }
  } else if (canvas?.dataset.lane === 'pace') {
    drag = { ...base, type: 'tempo-click' }
  } else if (canvas) {
    drag = { ...base, type: 'blank' }
  } else return
  editing.diagram.setPointerCapture(event.pointerId)
  event.preventDefault()
})

editing.diagram.addEventListener('pointermove', (event) => {
  if (!drag) return
  const tl = timelineNow()
  if (!tl) return
  const dx = event.clientX - drag.startX
  if (!drag.moved && Math.hypot(dx, event.clientY - drag.startY) < still) return
  drag.moved = true
  const snap = !event.shiftKey
  const names = namesNow()
  const dt = dx / ppsNow()
  if (drag.type === 'move-block') {
    const b = tl.blocks[drag.index]
    drag.clip.style.transform = `translateX(${dx}px)`
    const start = anchorAt(tl, names, b.startSeconds + dt, { side: 'from', snap, radius: snapRadius() })
    showLabel(`${event.altKey ? 'copy: ' : ''}${start.label}`, event)
  } else if (drag.type === 'stretch') {
    const b = tl.blocks[drag.index]
    const at = drag.side === 'left' ? b.startSeconds + dt : b.endSeconds + dt
    const found = anchorAt(tl, names, at, { side: drag.side === 'left' ? 'from' : 'to', snap, radius: snapRadius() })
    const [from, to] = drag.side === 'left' ? [found.seconds, b.endSeconds] : [b.startSeconds, found.seconds]
    drag.clip.style.left = `${from * ppsNow()}px`
    drag.clip.style.width = `${Math.max(2, (to - from) * ppsNow())}px`
    showLabel(found.label, event)
  } else if (drag.type === 'draw') {
    if (!drag.ghost) {
      drag.ghost = el('div', { className: 'ghost' })
      drag.canvas.append(drag.ghost)
    }
    const a = Math.min(secondsAt(drag.startX), secondsAt(event.clientX))
    const z = Math.max(secondsAt(drag.startX), secondsAt(event.clientX))
    const from = anchorAt(tl, names, a, { side: 'from', snap, radius: snapRadius() })
    const to = anchorAt(tl, names, z, { side: 'to', snap, radius: snapRadius() })
    drag.ghost.style.left = `${from.seconds * ppsNow()}px`
    drag.ghost.style.width = `${Math.max(2, (to.seconds - from.seconds) * ppsNow())}px`
    showLabel(`${from.label} → ${to.label}`, event)
  } else if (drag.type === 'fade') {
    const b = tl.blocks[drag.index]
    const track = tl.tracks.find((one) => one.id === b.track)
    const range = track.parameters.find((one) => one.name === drag.name)
    const fade = drag.name === 'fadeIn' ? secondsAt(event.clientX) - b.startSeconds : b.endSeconds - secondsAt(event.clientX)
    drag.value = Math.min(range?.maximum ?? 10, b.seconds, Math.max(0, Math.round(fade * 10) / 10))
    drag.clip.querySelector(`.ramp.${drag.name === 'fadeIn' ? 'in' : 'out'}`)?.style.setProperty('width', `${drag.value * ppsNow()}px`)
    showLabel(`${drag.name} ${drag.value.toFixed(1)} s`, event)
  } else if (drag.type === 'gain') {
    const track = tl.tracks.find((one) => one.id === tl.blocks[drag.index].track)
    const range = track.parameters.find((one) => one.name === 'gain')
    const rect = drag.clip.getBoundingClientRect()
    const level = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    drag.value = Math.round(level * (range?.maximum ?? 2) * 20) / 20
    drag.clip.querySelector('.gain-line')?.style.setProperty('top', `${Math.round((1 - drag.value / (range?.maximum ?? 2)) * 22)}px`)
    showLabel(`gain ${drag.value.toFixed(2)}`, event)
  } else if (drag.type === 'move-region') {
    drag.box.style.transform = `translateX(${dx}px)`
    const r = tl.regions[drag.index]
    const boundary = nearestBoundary(tl, r.startSeconds + r.seconds / 2 + dt)
    dropMarker(tl, boundary === drag.index || boundary === drag.index + 1 ? undefined : boundary)
    showLabel(`${r.name} → before ${boundary < tl.regions.length ? tl.regions[boundary].name : 'the end'}`, event)
  } else if (drag.type === 'seconds') {
    const r = tl.regions[drag.index]
    const value = Math.max(snap ? 1 : 0.5, snap ? Math.round(r.seconds + dt) : Math.round((r.seconds + dt) * 10) / 10)
    drag.value = value
    drag.box.style.width = `${value * ppsNow()}px`
    showLabel(`${r.name}: ${value.toFixed(1)} s`, event)
  } else if (drag.type === 'move-point') {
    drag.flag.style.transform = `translateX(${dx}px)`
    const at = regionAt(tl, secondsAt(event.clientX))
    dropMarker(tl, at)
    showLabel(`from ${tl.regions[at].name}`, event)
  } else if (drag.type === 'move-turn') {
    drag.flag.style.transform = `translateX(${dx}px)`
    const boundary = Math.min(tl.regions.length - 1, Math.max(1, nearestBoundary(tl, secondsAt(event.clientX))))
    dropMarker(tl, boundary)
    showLabel(`the words turn over before ${tl.regions[boundary].name}`, event)
  }
})

/** A thing is put in the draft: chosen, drawn again, checked: one step, however long the drag was. */
function commit(kind, index) {
  selection = kind ? { kind, index } : null
  showTimeline()
  shell.changed()
}

addEventListener('pointerup', (event) => {
  if (!drag) return
  const done = drag
  drag = null
  hideLabel()
  for (const old of editing.diagram.querySelectorAll('.drop-marker, .ghost')) old.remove()
  const tl = timelineNow()
  if (!tl) return
  const names = namesNow()
  const snap = !event.shiftKey
  const dt = (event.clientX - done.startX) / ppsNow()
  const draft = shell.draft
  if (!done.moved) {
    // a click: choose what is under it, or, on the tempo lane, a change of tempo
    if (done.type === 'move-block' || done.type === 'stretch' || done.type === 'fade' || done.type === 'gain') select({ kind: 'block', index: done.index })
    else if (done.type === 'move-region' || done.type === 'seconds') {
      if (pickingSource && selection?.kind === 'block') {
        const block = draft.blocks[selection.index]
        const name = tl.regions[done.index].name
        const had = block.source ?? []
        const next = had.includes(name) ? had.filter((one) => one !== name) : [...had, name]
        if (next.length) block.source = next
        else delete block.source
        showBlocks()
        shell.changed()
      } else select({ kind: 'region', index: done.index })
    } else if (done.type === 'move-point') select({ kind: 'tempo', index: done.index })
    else if (done.type === 'move-turn') select({ kind: 'turn', index: done.index })
    else if (done.type === 'tempo-click') {
      const at = regionAt(tl, secondsAt(event.clientX))
      const existing = pointsOf().find((point) => point.at === at)
      if (existing) return select({ kind: 'tempo', index: existing.index })
      addTempoPoint(at, tl)
    } else select(null)
    return
  }
  if (done.type === 'move-block') {
    const block = draft.blocks[done.index]
    const b = tl.blocks[done.index]
    const r = snapRadius()
    let from
    let to
    const start = anchorAt(tl, names, b.startSeconds + dt, { side: 'from', snap, radius: r })
    const end = anchorAt(tl, names, b.endSeconds + dt, { side: 'to', snap, radius: r })
    const oldFrom = boundaryOf(names, block.from)
    const oldTo = boundaryOf(names, block.to)
    // snapped on a region edge, a Block moves whole regions and keeps its shape: its seconds beyond an edge are its own
    if (snap && start.snapped === 'edge' && onBoundary(block.from) && oldFrom) {
      const by = boundaryOf(names, start.anchor).boundary - oldFrom.boundary
      from = shiftAnchor(names, block.from, by, 'from')
      to = shiftAnchor(names, block.to, by, 'to')
    } else if (snap && end.snapped === 'edge' && onBoundary(block.to) && oldTo) {
      const by = boundaryOf(names, end.anchor).boundary - oldTo.boundary
      from = shiftAnchor(names, block.from, by, 'from')
      to = shiftAnchor(names, block.to, by, 'to')
    }
    if (!from || !to) {
      from = anchorAt(tl, names, b.startSeconds + dt, { side: 'from', snap: false }).anchor
      to = anchorAt(tl, names, b.endSeconds + dt, { side: 'to', snap: false }).anchor
    }
    const next = { ...structuredClone(block), from, to }
    if (JSON.stringify(next) === JSON.stringify(block)) return redrawSession()
    if (event.altKey) {
      draft.blocks.push(next)
      return commit('block', draft.blocks.length - 1)
    }
    draft.blocks[done.index] = next
    return commit('block', done.index)
  }
  if (done.type === 'stretch') {
    const block = draft.blocks[done.index]
    const b = tl.blocks[done.index]
    const side = done.side === 'left' ? 'from' : 'to'
    const found = anchorAt(tl, names, (side === 'from' ? b.startSeconds : b.endSeconds) + dt, { side, snap, radius: snapRadius() })
    if ((side === 'from' && found.seconds >= b.endSeconds) || (side === 'to' && found.seconds <= b.startSeconds)) return redrawSession()
    block[side] = found.anchor
    return commit('block', done.index)
  }
  if (done.type === 'draw') {
    const a = Math.min(secondsAt(done.startX), secondsAt(event.clientX))
    const z = Math.max(secondsAt(done.startX), secondsAt(event.clientX))
    const from = anchorAt(tl, names, a, { side: 'from', snap, radius: snapRadius() })
    const to = anchorAt(tl, names, z, { side: 'to', snap, radius: snapRadius() })
    if (to.seconds <= from.seconds) return redrawSession()
    draft.blocks = [...(draft.blocks ?? []), newBlock(done.track, tl, from.anchor, to.anchor, from.seconds, to.seconds)]
    return commit('block', draft.blocks.length - 1)
  }
  if (done.type === 'fade') {
    const block = draft.blocks[done.index]
    setOrDrop(block, done.name, done.value === 0 ? '' : done.value)
    return commit('block', done.index)
  }
  if (done.type === 'gain') {
    const block = draft.blocks[done.index]
    setOrDrop(block, 'gain', done.value)
    return commit('block', done.index)
  }
  if (done.type === 'move-region') {
    const r = tl.regions[done.index]
    const boundary = nearestBoundary(tl, r.startSeconds + r.seconds / 2 + dt)
    const to = boundary > done.index ? boundary - 1 : boundary
    if (to === done.index) return redrawSession()
    const [moved] = draft.instances.splice(done.index, 1)
    draft.instances.splice(to, 0, moved)
    selection = { kind: 'region', index: to }
    showRows()
    return shell.changed()
  }
  if (done.type === 'seconds') {
    draft.instances[done.index].seconds = done.value
    return commit('region', done.index)
  }
  if (done.type === 'move-point') {
    const point = draft.tempo[done.index]
    const at = regionAt(tl, secondsAt(event.clientX))
    delete point.region
    delete point.hearing
    if (at > 0) Object.assign(point, regionRef(names, at))
    draft.tempo.sort((p, q) => (p.region === undefined ? 0 : (regionIndexOf(names, p.region, p.hearing) ?? 0)) - (q.region === undefined ? 0 : (regionIndexOf(names, q.region, q.hearing) ?? 0)))
    settleSeconds()
    return commit('tempo', draft.tempo.indexOf(point))
  }
  if (done.type === 'move-turn') {
    const boundary = Math.min(tl.regions.length - 1, Math.max(1, nearestBoundary(tl, secondsAt(event.clientX))))
    draft.turns[done.index] = anchorFor(names, boundary, 0, 'point')
    return commit('turn', done.index)
  }
  redrawSession()
})

/** A change of tempo at a region, the Mood's, kept in the order of the regions. */
function addTempoPoint(at, tl) {
  const names = namesNow()
  const draft = shell.draft
  const point = { bpm: 'mood' }
  if (at > 0) Object.assign(point, regionRef(names, at))
  const list = draft.tempo ?? []
  // a tempo map begins at the start of the Song
  if (!list.length && at > 0) list.push({ bpm: 'mood' })
  const order = (p) => (p.region === undefined ? 0 : (regionIndexOf(names, p.region, p.hearing) ?? 0))
  let place = list.findIndex((one) => order(one) > order(point))
  if (place < 0) place = list.length
  list.splice(place, 0, point)
  draft.tempo = list
  commit('tempo', list.indexOf(point))
}

editing.diagram.addEventListener('dblclick', (event) => {
  const tl = timelineNow()
  const canvas = event.target.closest('.canvas')
  if (!tl || canvas?.dataset.lane !== 'ruler' || event.target.closest('.turn-handle')) return
  const boundary = Math.min(tl.regions.length - 1, Math.max(1, nearestBoundary(tl, secondsAt(event.clientX))))
  const names = namesNow()
  const anchor = anchorFor(names, boundary, 0, 'point')
  const already = (shell.draft.turns ?? []).some((turn) => boundaryOf(names, turn)?.boundary === boundary)
  if (already) return
  shell.draft.turns = [...(shell.draft.turns ?? []), anchor]
  commit('turn', shell.draft.turns.length - 1)
})

// ---- the keys: Esc lets go, Del removes, the arrows nudge

const fields = { region: 'instances', tempo: 'tempo', turn: 'turns', block: 'blocks' }

function removeChosen() {
  if (!selection) return
  const list = shell.draft[fields[selection.kind]]
  list.splice(selection.index, 1)
  const kind = selection.kind
  selection = null
  tidy(fields[kind])
  settleSeconds()
  if (kind === 'region') showRows()
  else showTimeline()
  shell.changed()
}

function nudge(direction, big) {
  const tl = timelineNow()
  if (!selection || !tl) return
  const draft = shell.draft
  const names = namesNow()
  if (selection.kind === 'block') {
    const step = (big ? 1 : 0.1) * direction
    const block = draft.blocks[selection.index]
    for (const side of ['from', 'to']) {
      const plus = Math.round(((block[side].plus ?? 0) + step) * 1000) / 1000
      if (plus) block[side].plus = plus
      else delete block[side].plus
    }
  } else if (selection.kind === 'region') {
    const to = selection.index + direction
    if (to < 0 || to >= draft.instances.length) return
    ;[draft.instances[selection.index], draft.instances[to]] = [draft.instances[to], draft.instances[selection.index]]
    selection = { kind: 'region', index: to }
    showRows()
    return shell.changed()
  } else if (selection.kind === 'tempo') {
    const point = draft.tempo[selection.index]
    const at = (point.region === undefined ? 0 : regionIndexOf(names, point.region, point.hearing)) + direction
    if (at < 0 || at >= names.length) return
    delete point.region
    delete point.hearing
    if (at > 0) Object.assign(point, regionRef(names, at))
    settleSeconds()
  } else if (selection.kind === 'turn') {
    const at = boundaryOf(names, draft.turns[selection.index])
    if (!at) return
    const boundary = at.boundary + direction
    if (boundary < 1 || boundary > names.length - 1) return
    draft.turns[selection.index] = anchorFor(names, boundary, 0, 'point')
  }
  showTimeline()
  shell.changed()
}

addEventListener('keydown', (event) => {
  const typing = event.target.closest?.('input, select, textarea')
  if (event.key === 'Escape') {
    if (pickingSource) {
      pickingSource = false
      showTimeline()
    } else if (selection) select(null)
    if (drag) {
      drag = null
      hideLabel()
      redrawSession()
    }
    return
  }
  if (typing || event.metaKey || event.ctrlKey || event.altKey || !selection) return
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    removeChosen()
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    nudge(event.key === 'ArrowLeft' ? -1 : 1, event.shiftKey)
  }
})

// ---- seeing: zoom with the slider or Ctrl/Cmd-scroll, and fit the whole Song to the window

function zoomTo(next, anchorClientX) {
  const scroll = editing.scroll
  const before = anchorClientX === undefined ? undefined : (anchorClientX - originX()) / ppsNow()
  zoom = Math.min(16, Math.max(1, next))
  $('zoom').value = zoom
  redrawSession()
  if (before !== undefined) scroll.scrollLeft += originX() + before * ppsNow() - anchorClientX
}
$('zoom').addEventListener('input', () => zoomTo(Number($('zoom').value)))
$('fit').addEventListener('click', () => {
  zoomTo(1)
  editing.scroll.scrollLeft = 0
})
editing.scroll.addEventListener(
  'wheel',
  (event) => {
    if (!(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    zoomTo(zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15), event.clientX)
  },
  { passive: false },
)

  async function load() {
    const [partsJson, arrangementsJson, tracksJson] = await Promise.all([fetch('/parts.json').then((r) => r.json()), fetch('/arrangements.json').then((r) => r.json()), fetch('/tracks.json').then((r) => r.json())])
    parts = partsJson
    tracksThere = tracksJson
    arrangements = arrangementsJson
    $('add-part').replaceChildren(...activeParts().map((p) => el('option', { value: p.id, textContent: p.id })))
    hint()
    await shell.load()
  }

  $('tempo').addEventListener('change', () => shell.draft && shell.changed())
  load()
}
