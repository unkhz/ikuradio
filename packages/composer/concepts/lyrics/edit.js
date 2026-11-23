// The Lyrics as a bench (plan "Evolution of Song", "Learn and Edit", step 15): type a line for a part's line and see it against what the part asks at a wordiness: the
// slots it is meant to fill, the most its phrase can carry, and whether it grows with the Song's age; the syllables of what is typed are counted as the Score counts them, with
// rough ones marked. The counting is the part's own, asked of the server. Nothing here is saved.

function drawEdit(root, data) {
  const parts = data.lines.map((entry) => entry.part)
  const part = el('select', { id: 'bench-part' }, ...parts.map((id) => el('option', { value: id, textContent: id })))
  const line = el('select', { id: 'bench-line' }, ...[0, 1, 2, 3].map((i) => el('option', { value: i, textContent: `line ${i + 1}` })))
  const wordiness = el('input', { id: 'bench-wordiness', type: 'range', min: 0, max: 1, step: 0.05, value: 0.5 })
  const out = el('output', { id: 'bench-wordiness-out', textContent: '0.5' })
  const text = el('input', { id: 'bench-text', type: 'text', className: 'wide', autocomplete: 'off', spellcheck: false, placeholder: 'a line for it' })
  const back = el('button', { id: 'bench-sample', type: 'button', textContent: 'Back to the sample' })
  const body = el('div', { id: 'bench-body' })
  root.replaceChildren(
    el('p', { className: 'hint', textContent: 'A bench: nothing here is saved. Filled slots are what the line is meant to have; outlined, the most its phrase can carry.' }),
    el('div', { className: 'controls' }, el('label', {}, 'Part ', part), el('label', {}, 'Line ', line), el('label', {}, 'Wordiness ', wordiness, ' ', out), back),
    el('div', { className: 'controls' }, el('label', {}, 'The line ', text)),
    body,
  )

  let asking = 0
  async function show() {
    out.textContent = Number(wordiness.value).toFixed(2)
    const mine = ++asking
    const answer = await fetch(`/bench/lyrics?tempo=${data.tempo}`, { method: 'POST', body: JSON.stringify({ part: part.value, line: Number(line.value), wordiness: Number(wordiness.value), text: text.value }) }).then((r) => r.json())
    if (mine !== asking) return
    if (answer.refusal) return body.replaceChildren(el('p', { className: 'about', textContent: answer.refusal }))
    const { count, typed } = answer
    // what is typed, a syllable to a slot: filled up to what is meant, past it up to the most, and a mark where it overflows
    const typedSlots = el('span', { className: 'slots', title: `${typed.syllables} typed` }, ...Array.from({ length: Math.max(count.most, typed.syllables) }, (_, i) => el('i', { className: i < typed.syllables ? (i >= count.most ? 'over' : 'on') : '' })))
    const verdict = !typed.text ? 'Type a line to see it against these.' : typed.syllables > count.most ? `${typed.syllables} syllables: ${typed.syllables - count.most} too many; it cannot be sung in its bars${count.grows ? ' even with the bars it grows' : ''}` : typed.syllables < count.target ? `${typed.syllables} syllables: ${count.target - typed.syllables} short of what is meant` : `${typed.syllables} syllables: within what is meant and what it can carry`
    body.replaceChildren(
      el('section', { className: 'block-section' }, el('h2', { textContent: 'What the part asks' }), el('div', { className: 'count-block' }, lineSlots(count), el('small', { textContent: ` ${count.target} of ${count.most}${count.grows ? ' · it grows with the Song\'s age' : ''}` }))),
      el('section', { className: 'block-section' }, el('h2', { textContent: 'What is typed' }), el('div', { className: 'count-block' }, typedSlots, el('small', { textContent: ` ${typed.rough ? 'about ' : ''}${typed.syllables}` })), el('p', { className: 'facts', textContent: `${verdict}${typed.rough ? '. Some words are not in the dictionary, and their syllables are counted by a rough rule.' : ''}` }), el('p', { className: 'facts' }, ...typed.words.map((word) => el('span', { className: 'word', style: word.rough ? 'font-style:italic' : '', textContent: `${word.text} ` })))),
    )
  }
  for (const input of [part, line, wordiness, text]) input.addEventListener('input', show)
  back.addEventListener('click', () => {
    part.value = parts[0]
    line.value = 0
    wordiness.value = 0.5
    text.value = ''
    show()
  })
  show()
}
