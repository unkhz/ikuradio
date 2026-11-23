// The Parts in Edit (plan "Evolution of Song", "Learn and Edit", step 14). A part is code, and its shape cannot be edited here; what is edited is what an
// Arrangement gives each of its instances, within the part's schema. So the file open is an Arrangement, the strip is its instances, and what is chosen
// has its parameters as sliders, each in its range with the default marked and a reset, and under them each line's measure, asked of the part by the
// server and drawn again as a slider moves. Saved, it is the Arrangement's file. The page repeats no rule of any part.

const partsMarkup = `
<div id="shell"></div>
<p id="a-puts" class="hint"></p>
<div class="controls">
  <label>Tempo <input id="tempo" type="number" min="20" max="300" step="1" value="72" /> bpm</label>
  <span class="hint">Choose an instance, then move its sliders. What each line counts is asked of the part.</span>
</div>
<ol id="strip" class="strip" aria-label="The instances of the Arrangement"></ol>
<section id="panel" class="panel" hidden>
  <h3 id="panel-title"></h3>
  <div id="sliders" class="sliders"></div>
  <h3>What each line counts</h3>
  <div id="measure" class="measure"></div>
</section>
<p id="none-chosen" class="about">Open an Arrangement, and choose one of its instances.</p>
`

function drawEdit(root, data) {
  root.innerHTML = partsMarkup
  const parts = data
  let arrangements = []
  let chosen = null
  let measuring = 0
  /** The last timeline the Composer drew for the draft: where its words turn over. */
  let timeline = null
  /** The longest line seen for a part, so that its bars keep one scale as a slider moves. */
  const scaleOf = new Map()
  const tempo = () => Number($('tempo').value) || 72

  const shell = editShell({
    noun: 'Arrangement',
    list: async () => arrangements.map(({ id, title }) => ({ id, title })),
    fetch: async (id) => arrangements.find((one) => one.id === id).declaration,
    blank: () => ({ id: '', title: '', instances: [] }),
    idOf: (draft) => draft.id,
    check: (draft) => fetch(`/check?tempo=${tempo()}`, { method: 'POST', body: JSON.stringify(draft) }).then((r) => r.json()),
    format: (draft) => fetch('/format', { method: 'POST', body: JSON.stringify(draft) }).then((r) => r.json()),
    extra: () => chosen,
    restore: (kept) => {
      chosen = Number.isInteger(kept) ? kept : null
    },
    render: () => {
      $('a-puts').textContent = `Save puts one file: ${shell.draft.id || '<id>'}.json → packages/parts/arrangements/${shell.draft.id || '<id>'}/arrangement.json`
      showAll()
    },
    checked: (answer) => showChecked(answer),
  })
  $('shell').append(shell.bar)

  const partOf = (id) => parts.find((part) => part.id === id)

  function showAll() {
    showStrip()
    showPanel()
  }

  function showStrip() {
    const instances = shell.draft?.instances ?? []
    const iteration = (i) => timeline?.regions?.[i]?.iteration ?? 0
    $('strip').replaceChildren(
      ...instances.flatMap((instance, i) => {
        const chip = el('li', { className: `chip-instance${chosen === i ? ' chosen' : ''}`, textContent: '' }, el('strong', { textContent: instance.name }), el('small', { textContent: instance.part }))
        chip.style.background = colour(instance.part)
        chip.dataset.index = i
        chip.tabIndex = 0
        const choose = () => {
          chosen = i
          shell.remember()
          showAll()
        }
        chip.addEventListener('click', choose)
        chip.addEventListener('keydown', (event) => event.key === 'Enter' && choose())
        // where the words turn over, as the timeline marks it: a line between the two, and the number the Song is then
        if (i > 0 && timeline && iteration(i) !== iteration(i - 1)) {
          const turn = el('li', { className: 'turn-between', title: 'The words turn over here' }, el('span', { textContent: `turn → ${iteration(i) + 1}` }))
          return [turn, chip]
        }
        return [chip]
      }),
    )
  }

  /** A slider in the part's range, the default marked, with a reset and a field for an exact value. */
  function slider(instance, definition) {
    const { name, minimum = 0, maximum = 1, default: usual } = definition
    const step = maximum - minimum <= 1 ? 0.05 : 0.1
    const set = instance.parameters?.[name]
    const input = el('input', { type: 'range', min: minimum, max: maximum, step, value: set ?? usual ?? minimum })
    input.dataset.param = name
    const exact = el('input', { type: 'number', min: minimum, max: maximum, step: 'any', value: set ?? '', placeholder: usual ?? '', className: 'short' })
    exact.dataset.exact = name
    const reset = el('button', { type: 'button', textContent: 'reset', hidden: set === undefined })
    const mark = el('span', { className: 'usual', title: `The part's own: ${usual}, marked on the track` })
    mark.style.left = `${(((usual ?? minimum) - minimum) / (maximum - minimum || 1)) * 100}%`
    const settle = (value) => {
      if (value === '' || value === undefined) {
        if (instance.parameters) delete instance.parameters[name]
        if (instance.parameters && !Object.keys(instance.parameters).length) delete instance.parameters
      } else instance.parameters = { ...(instance.parameters ?? {}), [name]: Number(value) }
      const now = instance.parameters?.[name]
      reset.hidden = now === undefined
      exact.value = now ?? ''
      input.value = now ?? usual ?? minimum
      measure()
      shell.changed()
    }
    input.addEventListener('input', () => settle(Number(input.value)))
    exact.addEventListener('input', () => settle(exact.value === '' ? '' : Number(exact.value)))
    reset.addEventListener('click', () => settle(''))
    const row = el(
      'div',
      { className: 'slider-row' },
      el('span', { className: 'what', textContent: `${name} (${minimum} to ${maximum}, usually ${usual ?? 'none'})` }),
      el('span', { className: 'slider-track' }, input, mark),
      el('span', { className: 'value' }, exact, ' ', reset),
    )
    if (definition.description) row.append(el('small', { textContent: definition.description }))
    row.dataset.field = name
    return row
  }

  function showPanel() {
    const instance = shell.draft?.instances?.[chosen]
    $('panel').hidden = !instance
    $('none-chosen').hidden = Boolean(instance)
    if (!instance) return
    const part = partOf(instance.part)
    $('panel-title').textContent = `${instance.name}, a ${instance.part}`
    $('sliders').replaceChildren(...(part ? part.parameters.map((definition) => slider(instance, definition)) : [el('p', { className: 'about', textContent: 'This part is not among the parts there are.' })]))
    measure()
  }

  /** Each line's measure, asked of the server for the parameters as they stand, drawn as bars: what it counts, and how far it may go. */
  function measure() {
    const instance = shell.draft?.instances?.[chosen]
    if (!instance) return
    const mine = ++measuring
    setTimeout(async () => {
      if (mine !== measuring) return
      const answer = await fetch(`/measure?tempo=${tempo()}`, { method: 'POST', body: JSON.stringify({ part: instance.part, parameters: instance.parameters ?? {} }) }).then((r) => r.json())
      if (mine !== measuring) return
      const box = $('measure')
      if (answer.refusal) return box.replaceChildren(el('p', { className: 'about', textContent: answer.refusal }))
      if (!answer.lines.length) return box.replaceChildren(el('p', { className: 'about', textContent: 'This part has no words to count: it is hummed.' }))
      // one scale for a part, as wide as the longest line seen, in fours: so that a change reads as a size
      const wanted = Math.max(24, Math.ceil(Math.max(...answer.lines.map((line) => line.most)) / 4) * 4)
      const most = Math.max(scaleOf.get(instance.part) ?? 0, wanted)
      scaleOf.set(instance.part, most)
      const axis = el('div', { className: 'line-measure axis' }, el('span'), el('span', { className: 'ticks' }, ...[0, 0.25, 0.5, 0.75, 1].map((share) => Object.assign(el('span', { className: 'tick', textContent: String(Math.round(most * share)) }), { style: `left:${share * 100}%` }))), el('span', { className: 'says', textContent: 'syllables' }))
      box.replaceChildren(
        ...answer.lines.map((line) => {
          const bar = el('span', { className: 'fill-track' }, el('span', { className: 'fill most' }), el('span', { className: 'fill target' }))
          bar.querySelector('.fill.most').style.width = `${(line.most / most) * 100}%`
          bar.querySelector('.fill.target').style.width = `${(line.target / most) * 100}%`
          const row = el('div', { className: 'line-measure' }, el('span', { textContent: `line ${line.line + 1}` }), bar, el('span', { className: 'says', textContent: `${line.target} to ${line.most} syllables${line.grows ? ' ↗ grows with the Song\'s age' : ''}` }))
          row.dataset.line = line.line
          return row
        }),
        axis,
      )
      box.dataset.measured = String(measuring)
    }, 90)
  }

  function showChecked(answer) {
    if (!answer.refusal && answer.timeline && !answer.timeline.refusal) {
      timeline = answer.timeline
      showStrip()
    }
    for (const old of document.querySelectorAll('.chip-instance.refused')) old.classList.remove('refused')
    for (const old of document.querySelectorAll('#panel .why')) old.remove()
    if (!answer.refusal) return
    const where = answer.where
    if (where?.thing !== 'instance') return
    const chip = document.querySelector(`.chip-instance[data-index="${where.index}"]`)
    chip?.classList.add('refused')
    if (chosen === where.index) $('panel').append(el('div', { className: 'why', textContent: answer.refusal }))
  }

  $('tempo').addEventListener('change', () => {
    measure()
    if (shell.draft) shell.changed()
  })

  fetch('/arrangements.json')
    .then((r) => r.json())
    .then((found) => {
      arrangements = found
      return shell.load()
    })
}
