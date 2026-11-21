// The page of the Tides: every Tide with its record, what it moves, the range of that Setting, and its envelope drawn
// as a curve over the Songs around the one asked for, where that Song stands marked.

const svgNode = (tag, attributes = {}, ...children) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  node.append(...children)
  return node
}

const number = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(2))

/** One Tide's curve: its value, over Songs, within the range its Setting can be, with the envelope's rest and peak and the Song marked. */
function curveOf(tide, song, window) {
  const [width, height, left, right, top, bottom] = [640, 150, 44, 16, 12, 24]
  const [from, to] = window
  const [lo, hi] = tide.range
  const x = (position) => left + ((position - from) / (to - from)) * (width - left - right)
  // the curve is drawn so that its peak is up: a Tide whose peak is below its rest (the ceiling falls as the melody climbs) is flipped, and the ends of the axis say the values
  const flipped = tide.envelope.max < tide.envelope.min
  const y = (value) => top + (flipped ? (value - lo) / (hi - lo) : 1 - (value - lo) / (hi - lo)) * (height - top - bottom)
  const path = tide.curve.map(([position, value], i) => `${i ? 'L' : 'M'}${x(position).toFixed(1)} ${y(value).toFixed(1)}`).join(' ')
  const tick = (value) => svgNode('text', { x: left - 6, y: y(value) + 4, fill: 'var(--dim)', 'font-size': 11, 'text-anchor': 'end' }, number(value))
  return svgNode(
    'svg',
    { viewBox: `0 0 ${width} ${height}`, class: 'curve', role: 'img', 'aria-label': `${tide.title}: its value over the Songs around ${song}${flipped ? ', drawn with its peak up' : ''}` },
    svgNode('rect', { x: left, y: top, width: width - left - right, height: height - top - bottom, fill: 'none', stroke: 'var(--line)' }),
    svgNode('line', { x1: left, x2: width - right, y1: y(tide.envelope.min), y2: y(tide.envelope.min), stroke: 'var(--dim)', 'stroke-dasharray': '3 4', opacity: 0.6 }),
    svgNode('line', { x1: left, x2: width - right, y1: y(tide.envelope.max), y2: y(tide.envelope.max), stroke: 'var(--dim)', 'stroke-dasharray': '3 4', opacity: 0.6 }),
    svgNode('path', { d: path, fill: 'none', stroke: 'var(--made)', 'stroke-width': 2 }),
    svgNode('line', { x1: x(song), x2: x(song), y1: top, y2: height - bottom, stroke: 'var(--shapes)', 'stroke-dasharray': '4 3' }),
    svgNode('circle', { cx: x(song), cy: y(tide.now.value), r: 4.5, fill: 'var(--shapes)' }),
    tick(lo),
    tick(hi),
    svgNode('text', { x: left, y: height - 6, fill: 'var(--dim)', 'font-size': 11 }, `Song ${from}`),
    svgNode('text', { x: width - right, y: height - 6, fill: 'var(--dim)', 'font-size': 11, 'text-anchor': 'end' }, `Song ${to}`),
    svgNode('text', { x: x(song) + 6, y: top + 11, fill: 'var(--shapes)', 'font-size': 11 }, `Song ${song}`),
  )
}

function drawConcept(root, first) {
  const input = el('input', { type: 'number', min: 1, step: 1, value: first.song, id: 'song' })
  const cards = el('div', { className: 'cards tides' })

  const show = (data) => {
    cards.replaceChildren(
      ...data.tides.map((tide) => {
        const { envelope } = tide
        const facts = [`${tide.envelope.max < tide.envelope.min ? 'falls in number as it climbs: drawn with its peak up' : 'climbs as its number rises'}`, `moves ${tide.moves.facet}${tide.moves.part ? `.${tide.moves.part}` : ''}.${tide.moves.setting}`, `can be ${tide.range[0]} to ${tide.range[1]}`, `a cycle lasts ${envelope.age[0]} to ${envelope.age[1]} Songs`, `rests at ${number(envelope.min)}, peaks at ${number(envelope.max)}`, `rises ${Math.round(envelope.attack * 100)}%, holds ${Math.round(envelope.hold * 100)}%, falls ${Math.round(envelope.decay * 100)}% of a cycle`]
        if (envelope.noise) facts.push(`wanders by ${Math.round(envelope.noise * 100)}% of its swing`)
        return el(
          'article',
          { className: `card${tide.state === 'active' ? '' : ' retired'}` },
          el('h3', { textContent: tide.title }),
          el('div', { className: 'id', textContent: `${tide.slug}${tide.state === 'active' ? '' : ` · ${tide.state}`}` }),
          el('p', { textContent: tide.text }),
          el('ul', { className: 'facts-list' }, ...facts.map((fact) => el('li', { textContent: fact }))),
          curveOf(tide, data.song, data.window),
          el('div', { className: 'facts', textContent: `At Song ${data.song} it is ${number(tide.now.value)}, ${tide.now.phase}.` }),
        )
      }),
    )
  }

  const ask = async () => {
    const song = Math.max(1, Math.floor(Number(input.value) || 1))
    show(await fetch(`/tides.json?song=${song}`).then((r) => r.json()))
  }
  input.addEventListener('change', ask)
  root.replaceChildren(
    el('div', { className: 'controls' }, el('label', {}, 'Where the song is now: Song ', input), el('span', { className: 'total', textContent: 'The marker stands at this Song; the curves show the Songs around it.' })),
    cards,
  )
  show(first)
}
