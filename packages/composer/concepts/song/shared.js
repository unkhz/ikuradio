// The page of the Song: what a Session records, and an Arrangement laid out as a Session's parts would be. A Song that has
// been made is kept in the Archive, and is not shown here.

/** The words a part sings, as the pages say them: "the first verse", "the chorus"; "hummed" where there are none, "words of its own" where the Song as it always was has none for the name. */
function wordsSaid(part) {
  if (part.words) return `the ${part.words.replace(/([A-Z])/g, ' $1').toLowerCase()}`
  if (part.sings === 'spoken') return 'spoken words'
  if (part.sings === 'silent') return 'silence'
  return part.sings === 'written' ? 'words of its own' : 'hummed'
}

function drawBody(root, data, { fold = false } = {}) {
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
    el('thead', {}, el('tr', {}, ...['#', 'instance', 'kind', 'words', 'tempo', 'from', 'lasts', 'ends'].map((name) => el('th', { textContent: name })))),
    el('tbody', {}, ...data.parts.map((part) => el('tr', {}, el('td', { textContent: part.index + 1 }), el('td', { textContent: part.instance }), el('td', { textContent: part.kind }), el('td', { textContent: wordsSaid(part) }), el('td', { textContent: part.tempo === null ? 'free' : `${part.tempo ?? data.tempo} bpm` }), el('td', { textContent: `${part.start.toFixed(1)} s` }), el('td', { textContent: `${part.seconds.toFixed(1)} s` }), el('td', { textContent: part.ending === 'full' ? 'at home' : 'open' })))),
  )
  const session = el('table', {}, el('thead', {}, el('tr', {}, ...['a Session records', ''].map((name) => el('th', { textContent: name })))), el('tbody', {}, ...data.session.map((field) => el('tr', {}, el('td', { textContent: field.name }), el('td', { className: 'desc', textContent: field.says })))))
  const shown = [
    section('A Song as a Session would lay it out', el('p', { className: 'facts', textContent: `${data.arrangement ? `The Arrangement "${data.arrangement}", ` : ''}at ${data.tempo} beats a minute, at the first tune: ${data.parts.length} parts, ${data.seconds.toFixed(1)} seconds. A made Song is longer: its choruses grow with its age.` }), timeline, parts),
    ...(data.recordings?.length ? [section('The recordings it would name', el('p', { className: 'facts', textContent: 'One recording to a key of the timeline, on its Track: made once, and placed as many times as the key is.' }), el('table', {}, el('thead', {}, el('tr', {}, ...['track', 'key', 'from', 'lasts', 'placed'].map((name) => el('th', { textContent: name })))), el('tbody', {}, ...data.recordings.map((one) => el('tr', {}, el('td', { textContent: one.track }), el('td', { textContent: one.key }), el('td', { textContent: `${one.from.toFixed(1)} s` }), el('td', { textContent: `${one.seconds.toFixed(1)} s` }), el('td', { textContent: `${one.placed}×` }))))))] : []),
  ]
  const rest = [
    section('What a Session records', session),
    section('Where a Song is kept', el('p', { className: 'pending', textContent: 'A Song that has been made and aired is kept for ever in the Archive, as a Session and the recordings it names. It is not here: the Composer does not read the Archive.' })),
  ]
  // in Edit, what the bench changes is shown, and the rest of the page is folded away
  root.replaceChildren(...shown, ...(fold ? [el('details', { className: 'details' }, el('summary', { textContent: 'Details' }), ...rest)] : rest))
}
