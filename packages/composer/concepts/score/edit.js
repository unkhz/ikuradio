// The Score as a bench (plan "Evolution of Song", "Learn and Edit", step 15): type a line for a phrase and see its syllables fitted to the notes as the Score would set
// them: on the sixteenth grid, rough syllables in italics, and the Song's age growing on the reciting note where the words outgrow the phrase. The drawing is the Score's own
// page, from the server's answer for the line typed. Nothing here is saved.

function drawEdit(root, data) {
  const phrases = data.lines.map((line) => line.words.map((word) => word.text).join(' '))
  const sampleText = (index) => phrases[index] ?? ''
  const which = el('select', { id: 'bench-phrase' }, ...data.lines.map((_, i) => el('option', { value: i, textContent: `phrase ${i + 1}` })), el('option', { value: 'age', textContent: "the Song's age" }))
  const text = el('input', { id: 'bench-text', type: 'text', className: 'wide', autocomplete: 'off', spellcheck: false })
  const iteration = el('input', { id: 'bench-iteration', type: 'number', min: 1, step: 1, value: 1, className: 'short' })
  const tempo = el('input', { id: 'bench-tempo', type: 'number', min: 20, max: 300, step: 1, value: data.tempo, className: 'short' })
  const back = el('button', { id: 'bench-sample', type: 'button', textContent: 'Back to the sample' })
  const body = el('div', { id: 'bench-body' })
  const wordsRow = el('label', { id: 'text-row' }, 'The line ', text)
  const ageRow = el('label', { id: 'age-row', hidden: true }, 'Iteration ', iteration)
  root.replaceChildren(
    el('p', { className: 'hint', textContent: 'A bench: nothing here is saved. A line is fitted to its phrase as the Score would set it; one that does not fit is asked for again of the mind.' }),
    el('div', { className: 'controls' }, el('label', {}, 'For ', which), wordsRow, ageRow, el('label', {}, 'Tempo ', tempo, ' bpm'), back),
    body,
  )
  text.value = sampleText(0)

  let asking = 0
  async function show() {
    const age = which.value === 'age'
    wordsRow.hidden = age
    ageRow.hidden = !age
    const mine = ++asking
    const input = age ? { iteration: Number(iteration.value) || 1 } : { index: Number(which.value), text: text.value }
    const item = await fetch(`/bench/score?tempo=${Number(tempo.value) || data.tempo}`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.json())
    if (mine !== asking) return
    body.replaceChildren(el('section', { className: 'block-section' }, age ? scoreAge(item, data.scale) : scoreLine(item, data.scale)))
  }
  which.addEventListener('change', () => {
    if (which.value !== 'age') text.value = sampleText(Number(which.value))
    show()
  })
  for (const input of [text, iteration, tempo]) input.addEventListener('input', show)
  back.addEventListener('click', () => {
    which.value = '0'
    text.value = sampleText(0)
    iteration.value = 1
    tempo.value = data.tempo
    show()
  })
  show()
}
