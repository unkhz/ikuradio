// The Song as a bench (plan "Evolution of Song", "Learn and Edit", step 15): choose an Arrangement and a tempo, and see the Session it would make: its parts in order, with their kinds,
// their words and their seconds as the timeline puts them, and the recordings it would name. Nothing is made, and nothing here is saved.

function drawEdit(root, data) {
  const arrangement = el('select', { id: 'bench-arrangement' })
  const tempo = el('input', { id: 'bench-tempo', type: 'number', min: 20, max: 300, step: 1, value: data.tempo, className: 'short' })
  const back = el('button', { id: 'bench-sample', type: 'button', textContent: 'Back to the sample' })
  const body = el('div', { id: 'bench-body' })
  root.replaceChildren(
    el('p', { className: 'hint', textContent: 'A bench: no Song is made, and nothing is saved.' }),
    el('div', { className: 'controls' }, el('label', {}, 'Arrangement ', arrangement), el('label', {}, 'Tempo ', tempo, ' bpm'), back),
    body,
  )
  fetch('/arrangements.json')
    .then((r) => r.json())
    .then((found) => {
      arrangement.replaceChildren(...found.map((one) => el('option', { value: one.id, textContent: one.title })))
      arrangement.value = data.arrangement
    })

  let asking = 0
  async function show() {
    const mine = ++asking
    const answer = await fetch('/bench/song', { method: 'POST', body: JSON.stringify({ arrangement: arrangement.value || data.arrangement, tempo: Number(tempo.value) || data.tempo }) }).then((r) => r.json())
    if (mine !== asking) return
    drawBody(body, answer, { fold: true })
  }
  arrangement.addEventListener('change', show)
  tempo.addEventListener('input', show)
  back.addEventListener('click', () => {
    arrangement.value = data.arrangement
    tempo.value = data.tempo
    show()
  })
  show()
}
