// The Perspectives in Edit (plan "Evolution of Song", "Learn and Edit", step 14): a Perspective's record, edited as the file it is: the Facet it
// turns, the part it is kept for, how often it is drawn (its weight), its state and its words. Its Turn is code (actions.ts) and is shown, not edited:
// what it makes of the Settings, with it and without it, drawn from the same functions the Studio uses. Where Facets fight (two on one Facet and one part
// cannot be heard together) the server says which. Every rule is the package's, asked at /perspective/check.

const perspectivesMarkup = `
<div id="shell"></div>
<p id="p-puts" class="hint"></p>
<div id="editor" class="two" hidden>
  <section class="form">
    <h3>The record</h3>
    <div class="field"><label>Name <input id="p-slug" data-field="slug" type="text" autocomplete="off" spellcheck="false" /></label> <small>and the folder its Turn is in</small></div>
    <div class="field"><label>Facet <select id="p-facet" data-field="facet"></select></label></div>
    <div class="field" id="part-field"><label>Part <select id="p-part" data-field="part"></select></label></div>
    <div class="field"><label>Weight <input id="p-weight" data-field="weight" type="range" min="1" max="10" step="1" /> <output id="p-weight-out"></output></label> <small>how often it is drawn, against the others</small></div>
    <div class="field"><label>State <select id="p-state" data-field="state"></select></label></div>
    <div class="field"><label>Its words <textarea id="p-body" data-field="body" rows="9" spellcheck="true"></textarea></label></div>
  </section>
  <section class="preview">
    <h3>Heard</h3>
    <div id="p-odds"></div>
    <div id="p-clashes" class="about"></div>
    <h3>What its Turn makes of the Settings</h3>
    <p class="about">The Turn is code, in actions.ts, and is not edited here. The Settings are the defaults, then this Perspective's Turn.</p>
    <div id="p-turns"></div>
  </section>
</div>
`

function drawEdit(root, data) {
  root.innerHTML = perspectivesMarkup
  const { facets, partFacets, parts, states } = data.kinds
  let drafts = data.drafts
  const fill = (select, values, none) => select.replaceChildren(...(none ? [el('option', { value: '', textContent: none })] : []), ...values.map((value) => el('option', { value, textContent: value })))
  fill($('p-facet'), facets)
  fill($('p-part'), parts, 'all of them')
  fill($('p-state'), states)

  const shell = editShell({
    noun: 'Perspective',
    list: async () => drafts.map((draft) => ({ id: draft.slug, title: draft.slug })),
    fetch: async (slug) => drafts.find((draft) => draft.slug === slug),
    blank: () => ({ slug: '', id: Math.max(0, ...drafts.map((draft) => draft.id)) + 1, facet: facets[0], weight: 1, state: 'draft', body: '# \n\n' }),
    idOf: (draft) => draft.slug,
    check: (draft) => fetch('/perspective/check', { method: 'POST', body: JSON.stringify(draft) }).then((r) => r.json()),
    format: (draft) => fetch('/perspective/format', { method: 'POST', body: JSON.stringify(draft) }).then((r) => r.json()),
    render: (draft) => {
      $('editor').hidden = false
      $('p-slug').value = draft.slug
      $('p-facet').value = draft.facet
      $('p-part').value = draft.part ?? ''
      $('part-field').hidden = !partFacets.includes(draft.facet)
      $('p-weight').value = draft.weight
      $('p-weight-out').textContent = draft.weight
      $('p-state').value = draft.state
      $('p-body').value = draft.body
      $('p-puts').textContent = `Save puts one file: ${draft.slug}.perspective.md → perspectives/${draft.slug}/perspective.md`
    },
    checked: (answer) => showChecked(answer),
  })
  $('shell').append(shell.bar)

  const set = (change) => {
    change(shell.draft)
    $('part-field').hidden = !partFacets.includes(shell.draft.facet)
    $('p-weight-out').textContent = shell.draft.weight
    shell.changed()
  }
  $('p-slug').addEventListener('input', () => set((draft) => (draft.slug = $('p-slug').value)))
  $('p-facet').addEventListener('change', () => set((draft) => {
    draft.facet = $('p-facet').value
    if (!partFacets.includes(draft.facet)) delete draft.part
  }))
  $('p-part').addEventListener('change', () => set((draft) => ($('p-part').value ? (draft.part = $('p-part').value) : delete draft.part)))
  $('p-weight').addEventListener('input', () => set((draft) => (draft.weight = Number($('p-weight').value))))
  $('p-state').addEventListener('change', () => set((draft) => (draft.state = $('p-state').value)))
  $('p-body').addEventListener('input', () => set((draft) => (draft.body = $('p-body').value)))

  const number = (value) => (typeof value === 'number' ? (Number.isInteger(value) ? String(value) : value.toFixed(2)) : JSON.stringify(value))

  /** What the check said: on the field it is about, and, if it accepted, what the Perspective would be. */
  function showChecked(answer) {
    for (const old of document.querySelectorAll('#editor .refused')) old.classList.remove('refused')
    for (const old of document.querySelectorAll('#editor .why')) old.remove()
    if (answer.refusal) {
      const field = answer.field && document.querySelector(`#editor [data-field="${answer.field}"]`)
      if (field) {
        field.classList.add('refused')
        field.closest('.field')?.append(el('div', { className: 'why', textContent: answer.refusal }))
      }
      return
    }
    const { odds, clashes, turn, changed } = answer
    const share = Math.round(odds.share * 1000) / 10
    $('p-odds').replaceChildren(
      el('div', { className: 'odds-bar', title: `${share}% of the weight of the active Perspectives` }, Object.assign(el('span', {}), { style: `width:${share}%` })),
      el('div', { className: 'about', textContent: odds.active ? `Weight ${odds.weight} of ${odds.total} among the active: ${share}% of the draws that are made on its way of hearing.` : 'It is not active, so it is never drawn.' }),
    )
    $('p-clashes').textContent = clashes.length ? `It cannot be heard together with: ${clashes.map((one) => one.title).join(', ')}: they turn the same.` : 'It clashes with no active Perspective: it may be heard beside any of them.'
    const bars = changed.map((leaf) => {
      const numeric = typeof leaf.with === 'number' && typeof leaf.without === 'number'
      const top = Math.max(Math.abs(leaf.with), Math.abs(leaf.without), 1e-9)
      const bar = (value, className) => (numeric ? Object.assign(el('span', { className: `fill ${className}` }), { style: `width:${(Math.abs(value) / top) * 100}%` }) : el('span', { className: 'word', textContent: number(value) }))
      return el(
        'div',
        { className: 'turn-line' },
        el('span', { className: 'path', textContent: leaf.path.join('.') }),
        el('span', { className: 'pair' }, el('span', { className: 'tag', textContent: 'without' }), el('span', { className: 'fill-track' }, bar(leaf.without, 'without')), numeric ? el('span', { className: 'num', textContent: number(leaf.without) }) : ''),
        el('span', { className: 'pair' }, el('span', { className: 'tag', textContent: 'with' }), el('span', { className: 'fill-track' }, bar(leaf.with, 'with')), numeric ? el('span', { className: 'num', textContent: number(leaf.with) }) : ''),
      )
    })
    $('p-turns').replaceChildren(...(turn ? (bars.length ? bars : [el('p', { className: 'about', textContent: 'Its Turn changes nothing of the defaults.' })]) : [el('p', { className: 'about', textContent: 'No Turn is written for it yet: it turns nothing. A Turn is code, in a folder of this name.' })]))
  }

  shell.load()
}
