// The page of the parts: a card for each, with its record, what it is, and its parameters with their ranges. It names no part.
function drawConcept(root, parts) {
  root.replaceChildren(
    el(
      'div',
      { className: 'cards' },
      ...parts.map((part) => {
        const wordLabel = part.words === 'written' ? 'words written by the mind' : part.words === 'spoken' ? 'spoken words' : part.words === 'silent' ? 'silence' : 'no words'
        const facts = [wordLabel, part.ending === 'full' ? 'ends at home' : 'ends open', part.beats ? `fixed at ${beatsOf(part.beats)}` : 'as long as its lines']
        const rows = part.parameters.flatMap((p) => [
          el('tr', { className: 'main' }, el('td', { textContent: p.name }), el('td', { textContent: `${p.minimum ?? '…'} to ${p.maximum ?? '…'}` }), el('td', { textContent: p.default ?? '' })),
          ...(p.description ? [el('tr', {}, el('td', { className: 'desc', colSpan: 3, textContent: p.description }))] : []),
        ])
        const table = el('table', {}, el('thead', {}, el('tr', {}, ...['parameter', 'range', 'usual'].map((name) => el('th', { textContent: name })))), el('tbody', {}, ...rows))
        const card = el(
          'article',
          { className: `card${part.state === 'active' ? '' : ' retired'}` },
          el('h3', { textContent: part.title }),
          el('div', { className: 'id', textContent: `${part.id}${part.state === 'active' ? '' : ` · ${part.state}`}` }),
          el('p', { textContent: part.text }),
          el('div', { className: 'facts', textContent: facts.join(' · ') }),
          part.parameters.length ? table : el('p', { className: 'facts', textContent: 'No parameters.' }),
        )
        card.style.setProperty('--colour', colour(part.id))
        return card
      }),
    ),
  )
}
