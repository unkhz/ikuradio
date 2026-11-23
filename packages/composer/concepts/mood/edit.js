// The Mood as a bench (plan "Evolution of Song", "Learn and Edit", step 15): pick the weather, choose the mode and drag the tempo, and see the character the song
// would have follow. The mind is not asked: the mode is the one chosen, and the tempo is what it settles to, since it may not leap from where the song began.
// What is drawn is the Mood's own page, from the server's answer for these inputs. Nothing on a bench is saved.

function drawEdit(root, data) {
  const sample = { descriptions: [...data.first.descriptions], mode: data.born.mode, tempo: data.born.tempo }
  let state = structuredClone(sample)
  const mode = el('select', { id: 'bench-mode' }, ...data.modes.map((one) => el('option', { value: one.name, textContent: one.name })))
  const tempo = el('input', { id: 'bench-tempo', type: 'range', min: data.tempo.slowest, max: data.tempo.fastest, step: 1 })
  const asked = el('output', { id: 'bench-asked' })
  const settles = el('span', { id: 'bench-settles', className: 'hint' })
  const back = el('button', { id: 'bench-sample', type: 'button', textContent: 'Back to the sample' })
  const weather = el('div', { id: 'bench-weather', className: 'chips' })
  const body = el('div', { id: 'bench-body' })
  root.replaceChildren(
    el('p', { className: 'hint', textContent: 'A bench: nothing here is saved. The mind is not asked; the tempo settles, since it may not leap.' }),
    el('div', { className: 'controls' }, el('label', {}, 'Mode ', mode), el('label', {}, 'Tempo ', tempo, ' ', asked, ' bpm'), settles, back),
    el('h3', { textContent: 'The weather' }),
    weather,
    body,
  )

  let asking = 0
  async function show() {
    mode.value = state.mode
    tempo.value = state.tempo
    asked.textContent = state.tempo
    weather.replaceChildren(
      ...data.weather.map((word) => {
        const chip = el('button', { type: 'button', className: `chip${state.descriptions.includes(word) ? ' lit' : ''}`, textContent: word })
        chip.addEventListener('click', () => {
          state.descriptions = state.descriptions.includes(word) ? state.descriptions.filter((one) => one !== word) : [...state.descriptions, word]
          show()
        })
        return chip
      }),
    )
    const mine = ++asking
    const answer = await fetch('/bench/mood', { method: 'POST', body: JSON.stringify(state) }).then((r) => r.json())
    if (mine !== asking) return
    settles.textContent = answer.bench.settled === state.tempo ? '' : `asked ${state.tempo}, it settles to ${answer.bench.settled}: the next Song may move ${data.tempo.stride} either way`
    drawBody(body, answer)
  }
  mode.addEventListener('change', () => {
    state.mode = mode.value
    show()
  })
  tempo.addEventListener('input', () => {
    state.tempo = Number(tempo.value)
    show()
  })
  back.addEventListener('click', () => {
    state = structuredClone(sample)
    show()
  })
  show()
}
