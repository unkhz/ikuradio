// The page of the Perspectives: every one, with its record and what it turns from the defaults and how far; then the
// Settings themselves as a tree, each leaf with the Perspectives and the Tides that can move it.

const show = (value) => (value === undefined ? 'unset' : typeof value === 'string' ? value : JSON.stringify(value))

function treeOf(node) {
  if (!('children' in node)) {
    return el(
      'div',
      { className: 'leaf' },
      el('span', { className: 'leaf-name', textContent: node.name }),
      el('span', { className: 'leaf-value', textContent: show(node.value) }),
      ...node.perspectives.map((slug) => el('span', { className: 'chip shapes', textContent: slug, title: 'a Perspective that can turn this' })),
      ...node.tides.map((slug) => el('span', { className: 'chip tide', textContent: slug, title: 'a Tide that moves this' })),
    )
  }
  const open = node.children.some((child) => !('children' in child))
  return el('details', { className: 'branch', open }, el('summary', { textContent: node.name }), ...node.children.map(treeOf))
}

function drawConcept(root, data) {
  const active = data.perspectives.filter((p) => p.state === 'active')
  const cards = data.perspectives.map((p) => {
    const turns = p.turns.length
      ? el('table', { className: 'turns' }, el('tbody', {}, ...p.turns.map((turn) => el('tr', {}, el('td', {}, ...turn.path.flatMap((word, i) => (i ? [el('wbr'), `.${word}`] : [word]))), el('td', { textContent: `${show(turn.before)} → ${show(turn.after)}` })))))
      : el('p', { className: 'facts', textContent: 'Turns nothing from the defaults: what it asks for is already the usual.' })
    return el(
      'article',
      { className: `card${p.state === 'active' ? '' : ' retired'}` },
      el('h3', { textContent: p.title }),
      el('div', { className: 'id', textContent: `${p.slug} · ${p.facet}${p.part ? ` · ${p.part}` : ''}${p.state === 'active' ? '' : ` · ${p.state}`}` }),
      el('p', { textContent: p.text }),
      el('div', { className: 'weight', title: `weight ${p.weight} of 10: how likely it is to be drawn` }, el('span', { style: `width:${p.weight * 10}%` }), el('em', { textContent: `weight ${p.weight}` })),
      ...(p.variant ? [el('div', { className: 'facts', textContent: `variant heard: ${p.variant}` })] : []),
      turns,
    )
  })
  root.replaceChildren(
    el('p', { className: 'facts', textContent: `${data.perspectives.length} Perspectives, ${active.length} of them active; a Song is drawn a few by weight (the weights add up to ${data.weight}), never two on one thing.` }),
    el('h2', { textContent: 'The Perspectives' }),
    el('div', { className: 'cards' }, ...cards),
    el('h2', { textContent: 'The Settings, and who can move them' }),
    el('p', { className: 'facts', textContent: 'The Settings a Song begins with, as a tree. A Perspective turns the ones of its Facet; a Tide moves one number slowly over many Songs.' }),
    el('div', { className: 'tree' }, treeOf(data.settings)),
  )
}
