// The page of the Mood: what a Mood holds, the one the song was born in, the weather it draws from, the modes drawn as
// scales, and the range its tempo may move in. Everything comes from the page's data, which is the packages' own.

const svgNode = (tag, attributes = {}, ...children) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  node.append(...children)
  return node
}

const noteNames = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7']

/** A mode as the twelve semitones of an octave, the ones it sings marked with their place in the scale. */
function scaleOf(mode, born) {
  const keys = el('div', { className: 'scale' })
  for (let semitone = 0; semitone < 12; semitone++) {
    const place = mode.degrees.indexOf(semitone)
    const key = el('span', { className: `key${place >= 0 ? ' sung' : ''}${[1, 3, 6, 8, 10].includes(semitone) ? ' black' : ''}`, textContent: place >= 0 ? place + 1 : '', title: `${semitone} semitones above the tonic` })
    keys.append(key)
  }
  return el('div', { className: `mode${mode.name === born.mode ? ' born' : ''}` }, el('div', { className: 'mode-name', textContent: mode.name + (mode.name === born.mode ? ' · the song was born in this one' : '') }), keys)
}

/** The tempo as a line from the slowest to the fastest, with where the song began and how far it may move from there. */
function tempoOf({ slowest, fastest, stride }, born) {
  const width = 640
  const x = (bpm) => ((bpm - slowest) / (fastest - slowest)) * (width - 40) + 20
  const reach = [Math.max(slowest, born.tempo - stride), Math.min(fastest, born.tempo + stride)]
  return svgNode(
    'svg',
    { viewBox: `0 0 ${width} 90`, class: 'tempo', role: 'img', 'aria-label': 'The range of tempo' },
    svgNode('line', { x1: x(slowest), x2: x(fastest), y1: 40, y2: 40, stroke: 'var(--line)', 'stroke-width': 6, 'stroke-linecap': 'round' }),
    svgNode('line', { x1: x(reach[0]), x2: x(reach[1]), y1: 40, y2: 40, stroke: 'var(--shapes)', 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.5 }),
    svgNode('circle', { cx: x(born.tempo), cy: 40, r: 8, fill: 'var(--shapes)' }),
    svgNode('text', { x: x(slowest), y: 70, fill: 'var(--dim)', 'font-size': 13, 'text-anchor': 'middle' }, `${slowest}`),
    svgNode('text', { x: x(fastest), y: 70, fill: 'var(--dim)', 'font-size': 13, 'text-anchor': 'middle' }, `${fastest}`),
    svgNode('text', { x: x(born.tempo), y: 22, fill: 'var(--words)', 'font-size': 13, 'text-anchor': 'middle' }, `${born.tempo} bpm: where the song began`),
    svgNode('text', { x: x((reach[0] + reach[1]) / 2), y: 86, fill: 'var(--dim)', 'font-size': 12, 'text-anchor': 'middle' }, `the next Song may move ${stride} either way`),
  )
}

function drawBody(root, data) {
  const section = (title, ...children) => el('section', { className: 'block-section' }, el('h2', { textContent: title }), ...children)
  const chips = (words, lit = []) => el('div', { className: 'chips' }, ...words.map((word) => el('span', { className: `chip${lit.includes(word) ? ' lit' : ''}`, textContent: word })))
  root.replaceChildren(
    section(
      'What a Mood holds',
      el('table', {}, el('tbody', {}, ...data.holds.map((held) => el('tr', {}, el('td', { textContent: held.name }), el('td', { className: 'desc', textContent: held.says }))))),
    ),
    section('The Mood the song was born in', chips(data.first.descriptions, data.first.descriptions), el('p', { className: 'facts', textContent: `Sung in ${data.first.character.mode}, at ${data.first.character.tempo} beats a minute.` })),
    section('The weather it draws from', el('p', { className: 'facts', textContent: 'When the mind cannot choose, a new description is drawn from this list. The ones the song was born in are marked.' }), chips(data.weather, data.first.descriptions)),
    section('The modes', el('p', { className: 'facts', textContent: 'The mind hears the weather and chooses one. Each is a scale of seven degrees within an octave: the keys it sings are marked with their place in it.' }), ...data.modes.map((mode) => scaleOf(mode, data.born))),
    section('The tempo', el('p', { className: 'facts', textContent: 'It may not leap: between two Songs it moves a few beats a minute, as a walker changes pace.' }), tempoOf(data.tempo, data.born)),
  )
}
