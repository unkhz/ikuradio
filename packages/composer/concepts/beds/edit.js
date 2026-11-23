// The Beds as a bench (plan "Evolution of Song", "Learn and Edit", step 15): choose a part, and see the guide that MusicGen would be given for it: the words of its lines, timed
// to its phrases, and the two-voice guide with the chords that change where the words lean. No MusicGen is run, and nothing here is saved.

function drawEdit(root, data) {
  const ids = [...new Set(data.kinds.map((kind) => kind.part))]
  const part = el('select', { id: 'bench-part' }, ...ids.map((id) => el('option', { value: id, textContent: id })))
  const tempo = el('input', { id: 'bench-tempo', type: 'number', min: 20, max: 300, step: 1, value: data.tempo, className: 'short' })
  const back = el('button', { id: 'bench-sample', type: 'button', textContent: 'Back to the sample' })
  const body = el('div', { id: 'bench-body' })
  root.replaceChildren(
    el('p', { className: 'hint', textContent: 'A bench: no MusicGen is run, and nothing is saved. The guide is what the band would be asked to grow from.' }),
    el('div', { className: 'controls' }, el('label', {}, 'A bed for the ', part), el('label', {}, 'Tempo ', tempo, ' bpm'), back),
    body,
  )
  // the sample is the part the Beds page draws a guide for: the first that has one
  const sample = data.guide ? (ids.find((id) => data.kinds.some((kind) => kind.part === id && kind.kind === id)) ?? ids[0]) : ids[0]
  part.value = sample

  let asking = 0
  async function show() {
    const mine = ++asking
    const answer = await fetch('/bench/beds', { method: 'POST', body: JSON.stringify({ part: part.value, tempo: Number(tempo.value) || data.tempo }) }).then((r) => r.json())
    if (mine !== asking) return
    drawBody(body, answer)
  }
  part.addEventListener('change', show)
  tempo.addEventListener('input', show)
  back.addEventListener('click', () => {
    part.value = sample
    tempo.value = data.tempo
    show()
  })
  show()
}
