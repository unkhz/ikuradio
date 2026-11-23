// The Tune as a bench (plan "Evolution of Song", "Learn and Edit", step 15): choose a mode and how many Songs to evolve the tune, step on and step back, and
// see each phrase change. What is drawn is the Tune's own piano roll, from the server's answer for these inputs; the notes are named in the mode chosen. Nothing here is saved.

function drawEdit(root, data) {
  const sample = { songs: data.evolution.length - 1, mode: 'aeolian' }
  let state = { ...sample }
  const mode = el('select', { id: 'bench-mode' })
  const songs = el('input', { id: 'bench-songs', type: 'range', min: 0, max: 30, step: 1 })
  const back = el('button', { id: 'bench-back', type: 'button', textContent: '◀ a Song back' })
  const on = el('button', { id: 'bench-on', type: 'button', textContent: 'a Song on ▶' })
  const sampleButton = el('button', { id: 'bench-sample', type: 'button', textContent: 'Back to the sample' })
  const says = el('span', { id: 'bench-says', className: 'hint' })
  const body = el('div', { id: 'bench-body' })
  root.replaceChildren(
    el('p', { className: 'hint', textContent: 'A bench: nothing here is saved. Every Song each phrase takes one small step; coral notes are the ones that moved.' }),
    el('div', { className: 'controls' }, el('label', {}, 'Mode ', mode), back, el('label', {}, ' Songs on ', songs, ' ', says), on, sampleButton),
    body,
  )
  fetch('/mood.json')
    .then((r) => r.json())
    .then((mood) => {
      mode.replaceChildren(...mood.modes.map((one) => el('option', { value: one.name, textContent: one.name })))
      mode.value = state.mode
    })

  let asking = 0
  async function show() {
    songs.value = state.songs
    says.textContent = state.songs ? `${state.songs} Song${state.songs > 1 ? 's' : ''} on` : 'as it was born'
    back.disabled = state.songs <= 0
    on.disabled = state.songs >= 30
    const mine = ++asking
    const answer = await fetch('/bench/tune', { method: 'POST', body: JSON.stringify(state) }).then((r) => r.json())
    if (mine !== asking) return
    const last = answer.evolution.at(-1)
    const roll = (name) => el('div', { className: 'roll-box' }, rollSvg({ phrases: last.tunes[name], changed: last.tunes[name].map((phrase) => phrase.changed), grid: true }))
    body.replaceChildren(
      ...answer.names.map((name) =>
        el(
          'section',
          { className: 'block-section' },
          el('h2', { textContent: name }),
          roll(name),
          el('p', { className: 'facts', textContent: answer.evolves.includes(name) ? 'It evolves, Song by Song.' : 'It stays as it was born.' }),
          el('div', { className: 'note-names' }, ...answer.bench.names[name].map((notes, i) => el('div', { textContent: `phrase ${i + 1}: ${notes.join(' ')}` }))),
        ),
      ),
    )
  }
  mode.addEventListener('change', () => {
    state.mode = mode.value
    show()
  })
  songs.addEventListener('input', () => {
    state.songs = Number(songs.value)
    show()
  })
  back.addEventListener('click', () => {
    state.songs = Math.max(0, state.songs - 1)
    show()
  })
  on.addEventListener('click', () => {
    state.songs = Math.min(30, state.songs + 1)
    show()
  })
  sampleButton.addEventListener('click', () => {
    state = { ...sample, mode: mode.value ? 'aeolian' : 'aeolian' }
    mode.value = state.mode
    show()
  })
  show()
}
