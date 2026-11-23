// The Tides in Edit (plan "Evolution of Song", "Learn and Edit", step 14): a Tide's envelope drawn as one cycle, with its points to be dragged: the rest
// and the peak up and down, within what the Setting it moves can be, and where it climbs, holds and falls along its cycle. Under it the curve it makes over
// the Songs around a chosen Song, with that Song marked, and a slider to move the Song along it. The Tide is two files, a record and an envelope; Save
// downloads both. Every rule is the package's, asked at /tide/check, and the curve is drawn from the server's reading of the envelope.

const tidesMarkup = `
<div id="shell"></div>
<p id="t-puts" class="hint"></p>
<div id="editor" class="two" hidden>
  <section class="form">
    <h3>The Tide</h3>
    <div class="field"><label>Name <input id="t-slug" data-field="slug" type="text" autocomplete="off" spellcheck="false" /></label></div>
    <div class="field"><label>State <select id="t-state" data-field="state"><option>draft</option><option>active</option><option>retired</option></select></label></div>
    <div class="field" data-field="moves"><span class="what">Moves</span> <select id="t-facet"></select> <select id="t-part"></select> <select id="t-setting"></select></div>
    <div class="field" data-field="age"><label>A cycle lasts <input id="t-age0" type="number" min="1" step="1" class="short" /> to <input id="t-age1" type="number" min="1" step="1" class="short" /> Songs</label></div>
    <div class="field" data-field="attack"><label>Rises <input id="t-attack" type="range" min="0" max="1" step="0.05" /> <output id="t-attack-out"></output></label></div>
    <div class="field"><label>Holds <input id="t-hold" data-field="hold" type="range" min="0" max="1" step="0.05" /> <output id="t-hold-out"></output></label></div>
    <div class="field"><label>Falls <input id="t-decay" data-field="decay" type="range" min="0" max="1" step="0.05" /> <output id="t-decay-out"></output></label></div>
    <div class="field"><label>At rest <input id="t-min" data-field="min" type="number" step="any" class="short" /> peaks at <input id="t-max" data-field="max" type="number" step="any" class="short" /></label> <small id="t-range"></small></div>
    <div class="field"><label>Wanders <input id="t-noise" data-field="noise" type="range" min="0" max="1" step="0.05" /> <output id="t-noise-out"></output></label> <small>a share of its swing</small></div>
    <div class="field"><label>Changes every <input id="t-grain" data-field="grain" type="number" min="0.1" step="0.1" class="short" /> Songs</label></div>
    <div class="field"><label>Its words <textarea id="t-body" data-field="body" rows="6"></textarea></label></div>
  </section>
  <section class="preview">
    <h3>One cycle</h3>
    <p class="about">Drag the points: up and down for the setting, along for the share of the cycle.</p>
    <div id="t-cycle"></div>
    <h3>Over the Songs</h3>
    <div class="controls"><label>Where the song is now: Song <input id="t-song" type="number" min="1" step="1" value="1" class="short" /></label> <input id="t-song-slider" type="range" min="1" max="100" step="1" value="1" /></div>
    <div id="t-curve"></div>
    <div id="t-now" class="about"></div>
  </section>
</div>
`

function drawEdit(root, data) {
  root.innerHTML = tidesMarkup
  let drafts = data.drafts
  const movable = data.movable
  let song = data.song ?? 1
  let range = [0, 1]
  const shape = (tag, attributes = {}, ...children) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
    node.append(...children)
    return node
  }
  const fill = (select, values) => select.replaceChildren(...values.map((value) => el('option', { value, textContent: value })))
  fill($('t-facet'), Object.keys(movable))

  const shell = editShell({
    noun: 'Tide',
    list: async () => drafts.map((draft) => ({ id: draft.slug, title: draft.slug })),
    fetch: async (slug) => drafts.find((draft) => draft.slug === slug),
    blank: () => {
      // the first of what a Tide may move, as the Composer lists it
      const [facet, kind] = Object.entries(movable)[0]
      return { slug: '', id: Math.max(0, ...drafts.map((draft) => draft.id)) + 1, state: 'draft', body: '# \n\n', moves: { facet, part: kind.parts[0], setting: kind.settings[0] }, age: [3, 5], attack: 0.3, hold: 0.2, decay: 0.3, min: 0, max: 1, noise: 0, grain: 1 }
    },
    idOf: (draft) => draft.slug,
    check: (draft) => fetch(`/tide/check?song=${song}`, { method: 'POST', body: JSON.stringify(draft) }).then((r) => r.json()),
    format: (draft) => fetch('/tide/format', { method: 'POST', body: JSON.stringify(draft) }).then((r) => r.json()),
    render: (draft) => {
      $('editor').hidden = false
      showFields(draft)
    },
    checked: (answer) => showChecked(answer),
  })
  $('shell').append(shell.bar)

  const rounded = (value, to = 0.05) => Math.round(value / to) * to
  const tidy = (value) => Number(value.toFixed(3))

  /** The fields, as the draft has them: the moves' menus follow the Facet, and the readouts say the shares. */
  function showFields(draft) {
    $('t-slug').value = draft.slug
    $('t-state').value = draft.state
    $('t-facet').value = draft.moves.facet
    fill($('t-part'), movable[draft.moves.facet]?.parts ?? [draft.moves.part])
    fill($('t-setting'), movable[draft.moves.facet]?.settings ?? [draft.moves.setting])
    $('t-part').value = draft.moves.part
    $('t-setting').value = draft.moves.setting
    $('t-age0').value = draft.age[0]
    $('t-age1').value = draft.age[1]
    for (const name of ['attack', 'hold', 'decay']) {
      $(`t-${name}`).value = draft[name]
      $(`t-${name}-out`).textContent = `${Math.round(draft[name] * 100)}% of a cycle`
    }
    $('t-min').value = draft.min
    $('t-max').value = draft.max
    $('t-noise').value = draft.noise ?? 0
    $('t-noise-out').textContent = `${Math.round((draft.noise ?? 0) * 100)}%`
    $('t-grain').value = draft.grain ?? 1
    $('t-body').value = draft.body
    $('t-puts').textContent = `Save puts two files: ${draft.slug}.tide.md → tides/${draft.slug}/tide.md, ${draft.slug}.actions.ts → tides/${draft.slug}/actions.ts`
  }

  const set = (change) => {
    change(shell.draft)
    showFields(shell.draft)
    shell.changed()
  }
  $('t-slug').addEventListener('input', () => set((draft) => (draft.slug = $('t-slug').value)))
  $('t-state').addEventListener('change', () => set((draft) => (draft.state = $('t-state').value)))
  $('t-facet').addEventListener('change', () => set((draft) => {
    const kind = movable[$('t-facet').value]
    draft.moves = { facet: $('t-facet').value, part: kind.parts[0], setting: kind.settings[0] }
  }))
  $('t-part').addEventListener('change', () => set((draft) => (draft.moves = { ...draft.moves, part: $('t-part').value })))
  $('t-setting').addEventListener('change', () => set((draft) => (draft.moves = { ...draft.moves, setting: $('t-setting').value })))
  $('t-age0').addEventListener('input', () => set((draft) => (draft.age = [Number($('t-age0').value), draft.age[1]])))
  $('t-age1').addEventListener('input', () => set((draft) => (draft.age = [draft.age[0], Number($('t-age1').value)])))
  for (const name of ['attack', 'hold', 'decay', 'noise']) $(`t-${name}`).addEventListener('input', () => set((draft) => (draft[name] = Number($(`t-${name}`).value))))
  $('t-min').addEventListener('input', () => set((draft) => (draft.min = Number($('t-min').value))))
  $('t-max').addEventListener('input', () => set((draft) => (draft.max = Number($('t-max').value))))
  $('t-grain').addEventListener('input', () => set((draft) => (draft.grain = Number($('t-grain').value))))
  $('t-body').addEventListener('input', () => set((draft) => (draft.body = $('t-body').value)))

  // ---- the Song the curve is read at
  const moveSong = (next) => {
    song = Math.max(1, Math.floor(next) || 1)
    $('t-song').value = song
    $('t-song-slider').value = Math.min(Number($('t-song-slider').max), song)
    if (shell.draft) shell.changed()
  }
  $('t-song').addEventListener('input', () => moveSong(Number($('t-song').value)))
  $('t-song-slider').addEventListener('input', () => moveSong(Number($('t-song-slider').value)))
  $('t-song').value = song

  // ---- one cycle, with points to take hold of
  const [width, height, left, right, top, bottom] = [520, 210, 48, 20, 30, 28]
  /** What the editing mouse is doing to the cycle drawn. */
  let held = null
  /** Whether the axis is drawn upside down, so that the peak is up, as Learn draws it: a Tide whose peak is a lower number than its rest (a ceiling that falls as the melody climbs). Held while a point is taken, so that it does not turn over under the hand. */
  const flippedNow = () => (held ? held.flipped : shell.draft.max < shell.draft.min)

  function cycleSvg() {
    const draft = shell.draft
    const [lo, hi] = range
    const x = (share) => left + share * (width - left - right)
    const flipped = flippedNow()
    const y = (value) => top + (flipped ? (value - lo) / (hi - lo || 1) : 1 - (value - lo) / (hi - lo || 1)) * (height - top - bottom)
    const a = draft.attack
    const h = draft.hold
    const d = draft.decay
    const points = [[0, draft.min], [a, draft.max], [a + h, draft.max], [a + h + d, draft.min], [1, draft.min]]
    const svg = shape('svg', { viewBox: `0 0 ${width} ${height}`, class: 'cycle', role: 'img', 'aria-label': 'One cycle of the Tide' })
    svg.append(shape('rect', { x: left, y: top, width: width - left - right, height: height - top - bottom, fill: 'none', stroke: 'var(--line)' }))
    svg.append(shape('path', { d: points.map(([share, value], i) => `${i ? 'L' : 'M'}${x(share).toFixed(1)} ${y(value).toFixed(1)}`).join(' '), fill: 'none', stroke: 'var(--made)', 'stroke-width': 2.5 }))
    for (const [value, label] of [[lo, String(lo)], [hi, String(hi)]]) svg.append(shape('text', { x: left - 6, y: y(value) + 4, fill: 'var(--dim)', 'font-size': 11, 'text-anchor': 'end' }, label))
    svg.append(shape('text', { x: left, y: height - 8, fill: 'var(--dim)', 'font-size': 11 }, 'a cycle begins'), shape('text', { x: width - right, y: height - 8, fill: 'var(--dim)', 'font-size': 11, 'text-anchor': 'end' }, 'and begins again'))
    /** A point to take hold of: which of the envelope's numbers it moves along, and which up and down. */
    const says = { attack: ['rises', 'where it reaches its peak: along for how long it rises, up and down for how high'], hold: ['holds', 'where it stops holding the peak: along for how long it holds'], decay: ['falls', 'where it is back at rest: along for how long it falls, up and down for where it rests'] }
    const handle = (name, share, value, moves) => {
      const dot = shape('circle', { cx: x(share), cy: y(value), r: 7, class: 'handle', 'data-handle': name, fill: 'var(--shapes)', stroke: 'var(--words)', 'stroke-width': 1.5, cursor: moves === 'both' ? 'move' : 'ew-resize' }, shape('title', {}, `${says[name][0]}: ${says[name][1]}`))
      svg.append(shape('text', { x: x(share), y: y(value) + (name === 'decay' ? 20 : -12), fill: 'var(--shapes)', 'font-size': 11, 'text-anchor': 'middle', 'pointer-events': 'none' }, says[name][0]))
      dot.addEventListener('pointerdown', (event) => {
        held = { name, moved: false, flipped: shell.draft.max < shell.draft.min }
        event.preventDefault()
      })
      return dot
    }
    svg.append(handle('attack', a, draft.max, 'both'), handle('hold', a + h, draft.max, 'along'), handle('decay', a + h + d, draft.min, 'both'))
    return svg
  }

  // the mouse is followed on the whole page, since the cycle is drawn anew as a point moves
  addEventListener('pointermove', (event) => {
    if (!held) return
    const svg = $('t-cycle').querySelector('svg')
    if (!svg) return
    held.moved = true
    const [lo, hi] = range
    const box = svg.getBoundingClientRect()
    const scale = width / box.width
    const share = Math.min(1, Math.max(0, ((event.clientX - box.left) * scale - left) / (width - left - right)))
    const across = Math.min(1, Math.max(0, ((event.clientY - box.top) * scale - top) / (height - top - bottom)))
    // up is toward the peak as drawn: the number is the Setting's own, from the axis as it is drawn
    const value = lo + (held.flipped ? across : 1 - across) * (hi - lo)
    const next = shell.draft
    const step = hi - lo <= 1 ? 0.05 : 0.5
    if (held.name === 'attack') {
      next.attack = tidy(Math.min(rounded(share), 1 - next.hold - next.decay))
      next.max = tidy(rounded(value, step))
    } else if (held.name === 'hold') next.hold = tidy(Math.max(0, Math.min(rounded(share - next.attack), 1 - next.attack - next.decay)))
    else {
      next.decay = tidy(Math.max(0, Math.min(rounded(share - next.attack - next.hold), 1 - next.attack - next.hold)))
      next.min = tidy(rounded(value, step))
    }
    showFields(next)
    $('t-cycle').replaceChildren(cycleSvg())
  })
  const drop = () => {
    if (!held) return
    const done = held
    held = null
    if (done.moved) shell.changed()
  }
  addEventListener('pointerup', drop)
  addEventListener('pointercancel', drop)

  // ---- the curve over the Songs, from the server
  function curveSvg(answer) {
    const [w, h, l, r, t, b] = [560, 170, 48, 16, 14, 28]
    const [from, to] = answer.window
    const [lo, hi] = answer.range
    const x = (position) => l + ((position - from) / (to - from)) * (w - l - r)
    const flipped = flippedNow()
    const y = (value) => t + (flipped ? (value - lo) / (hi - lo || 1) : 1 - (value - lo) / (hi - lo || 1)) * (h - t - b)
    const svg = shape('svg', { viewBox: `0 0 ${w} ${h}`, class: 'curve', role: 'img', 'aria-label': 'The Tide over the Songs around the one chosen' })
    svg.append(shape('rect', { x: l, y: t, width: w - l - r, height: h - t - b, fill: 'none', stroke: 'var(--line)' }))
    for (const cycle of answer.cycles) if (cycle.begins > from && cycle.begins < to) svg.append(shape('line', { x1: x(cycle.begins), x2: x(cycle.begins), y1: t, y2: h - b, stroke: 'var(--line)', 'stroke-dasharray': '2 3' }))
    svg.append(shape('path', { d: answer.curve.map(([position, value], i) => `${i ? 'L' : 'M'}${x(position).toFixed(1)} ${y(value).toFixed(1)}`).join(' '), fill: 'none', stroke: 'var(--made)', 'stroke-width': 2 }))
    svg.append(shape('line', { x1: x(answer.song), x2: x(answer.song), y1: t, y2: h - b, stroke: 'var(--shapes)', 'stroke-dasharray': '4 3' }), shape('circle', { cx: x(answer.song), cy: y(answer.now.value), r: 4.5, fill: 'var(--shapes)' }))
    for (const value of [lo, hi]) svg.append(shape('text', { x: l - 6, y: y(value) + 4, fill: 'var(--dim)', 'font-size': 11, 'text-anchor': 'end' }, String(value)))
    svg.append(shape('text', { x: l, y: h - 8, fill: 'var(--dim)', 'font-size': 11 }, `Song ${from}`), shape('text', { x: w - r, y: h - 8, fill: 'var(--dim)', 'font-size': 11, 'text-anchor': 'end' }, `Song ${to}`))
    return svg
  }

  function showChecked(answer) {
    for (const old of document.querySelectorAll('#editor .refused')) old.classList.remove('refused')
    for (const old of document.querySelectorAll('#editor .why')) old.remove()
    if (answer.refusal) {
      const field = answer.field && document.querySelector(`#editor [data-field="${answer.field}"]`)
      if (field) {
        field.classList.add('refused')
        ;(field.closest('.field') ?? field).append(el('div', { className: 'why', textContent: answer.refusal }))
      }
      return
    }
    range = answer.range
    $('t-range').textContent = `it can be ${range[0]} to ${range[1]}`
    $('t-song-slider').max = String(Math.max(100, song + 50))
    if (!held) $('t-cycle').replaceChildren(cycleSvg())
    $('t-curve').replaceChildren(curveSvg(answer))
    $('t-now').textContent = `At Song ${answer.song} it is ${Number(answer.now.value.toFixed(2))}, ${answer.now.phase}.`
  }

  shell.load()
}
