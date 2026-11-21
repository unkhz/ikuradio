// The page of the Song: what a Session records, and an Arrangement laid out as a Session's parts would be. A Song that has
// been made is kept in the Archive, and is not shown here.

function drawConcept(root, data) {
  const section = (title, ...children) => el('section', { className: 'block-section' }, el('h2', { textContent: title }), ...children)
  const width = 960
  const x = (seconds) => (seconds / data.seconds) * width
  const timeline = el(
    'div',
    { className: 'songline', style: `width:${width}px;max-width:100%` },
    ...data.parts.map((part) => {
      const block = el('div', { className: 'songpart', title: `${part.instance}: ${part.kind}, from ${part.start.toFixed(1)} s for ${part.seconds.toFixed(1)} s` }, el('span', { textContent: part.instance }))
      block.style.cssText = `left:${(x(part.start) / width) * 100}%;width:${(x(part.seconds) / width) * 100}%;background:${colour(part.part)}`
      return block
    }),
  )
  const parts = el(
    'table',
    {},
    el('thead', {}, el('tr', {}, ...['#', 'instance', 'kind', 'words', 'from', 'lasts', 'ends'].map((name) => el('th', { textContent: name })))),
    el('tbody', {}, ...data.parts.map((part) => el('tr', {}, el('td', { textContent: part.index + 1 }), el('td', { textContent: part.instance }), el('td', { textContent: part.kind }), el('td', { textContent: part.words ?? 'none: hummed' }), el('td', { textContent: `${part.start.toFixed(1)} s` }), el('td', { textContent: `${part.seconds.toFixed(1)} s` }), el('td', { textContent: part.ending === 'full' ? 'at home' : 'open' })))),
  )
  const session = el('table', {}, el('thead', {}, el('tr', {}, ...['a Session records', ''].map((name) => el('th', { textContent: name })))), el('tbody', {}, ...data.session.map((field) => el('tr', {}, el('td', { textContent: field.name }), el('td', { className: 'desc', textContent: field.says })))))
  root.replaceChildren(
    section('A Song as a Session would lay it out', el('p', { className: 'facts', textContent: `${data.arrangement ? `The Arrangement "${data.arrangement}", ` : ''}at ${data.tempo} beats a minute, at the first tune: ${data.parts.length} parts, ${data.seconds.toFixed(1)} seconds. A made Song is longer: its choruses grow with its age.` }), timeline, parts),
    section('What a Session records', session),
    section('Where a Song is kept', el('p', { className: 'pending', textContent: 'A Song that has been made and aired is kept for ever in the Archive, as a Session and the recordings it names. It is not here: the Composer does not read the Archive.' })),
  )
}
