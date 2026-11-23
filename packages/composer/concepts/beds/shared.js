// The page of the Beds: what the band is asked to grow, and the guide it grows from. The Beds themselves are made by
// MusicGen from a hummed guide, and are not drawn here.

const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

function drawBody(root, data) {
  const section = (title, ...children) => el('section', { className: 'block-section' }, el('h2', { textContent: title }), ...children)

  const kinds = el(
    'table',
    {},
    el('thead', {}, el('tr', {}, ...['#', 'instance', 'bed kind', 'beats', 'seconds'].map((name) => el('th', { textContent: name })))),
    el('tbody', {}, ...data.kinds.map((kind, i) => el('tr', {}, el('td', { textContent: i + 1 }), el('td', { textContent: kind.instance }), el('td', {}, el('span', { className: 'chip', style: `border-color:${colour(kind.part)};color:${colour(kind.part)}`, textContent: kind.kind })), el('td', { textContent: kind.beats }), el('td', { textContent: kind.seconds.toFixed(1) })))),
  )

  // a part with no words has no guide composed from words: it is hummed from the parts either side of it
  if (!data.guide) {
    root.replaceChildren(
      section('The beds an Arrangement asks for', el('p', { className: 'facts', textContent: `One for each part; a part with no words is told its own band by the parts either side of it. At ${data.tempo} beats a minute.` }), kinds),
      section('The guide a section is grown from', el('p', { className: 'pending', textContent: 'This part has no words: it is hummed from the parts either side of it, and no guide is composed from words here.' })),
    )
    return
  }

  // the guide: its chords along the beats, coloured by where they stand in relation to home
  const width = 640
  const x = (beats) => (beats / data.guide.beats) * (width - 4) + 2
  const chordColour = { home: 'var(--made)', away: 'var(--edits)', tension: 'var(--shapes)' }
  const chords = svgElement(
    'svg',
    { viewBox: `0 0 ${width} 64`, class: 'guide', role: 'img', 'aria-label': 'The chords of the guide' },
    ...data.guide.chords.flatMap((chord, i) => [
      svgElement('rect', { x: x(chord.at), y: 4, width: Math.max(2, x(chord.at + chord.beats) - x(chord.at) - 2), height: 40, rx: 4, fill: chordColour[chord.function] ?? 'var(--dim)', opacity: i === data.guide.furthest ? 1 : 0.7, stroke: i === data.guide.furthest ? 'var(--words)' : 'none' }),
      svgElement('text', { x: x(chord.at) + 6, y: 29, fill: '#101015', 'font-size': 14, 'font-weight': 700 }, romans[chord.root] ?? chord.root),
    ]),
    svgElement('text', { x: 2, y: 60, fill: 'var(--dim)', 'font-size': 11 }, 'beat 0'),
    svgElement('text', { x: width - 2, y: 60, fill: 'var(--dim)', 'font-size': 11, 'text-anchor': 'end' }, `beat ${data.guide.beats}`),
  )
  const voice = (notes) => rollSvg({ phrases: [{ notes, rest: 0 }], grid: true, beat: width / data.guide.beats })

  root.replaceChildren(
    section('The beds an Arrangement asks for', el('p', { className: 'facts', textContent: `One for each part; a part with no words is told its own band by the parts either side of it. At ${data.tempo} beats a minute.` }), kinds),
    section(
      'The guide a section is grown from',
      el('p', { className: 'facts', textContent: `The words of a section, timed, make a two-voice guide: ${data.guide.syllables} syllables, ${data.guide.chords.length} chords, which change where the words lean. The ringed chord is the furthest from home. The colours say home, away and tension.` }),
      chords,
      el('p', { className: 'facts', textContent: 'the lower voice' }),
      el('div', { className: 'roll-box' }, voice(data.guide.lower)),
      el('p', { className: 'facts', textContent: 'the upper voice' }),
      el('div', { className: 'roll-box' }, voice(data.guide.upper)),
    ),
    section('What is not drawn', el('p', { className: 'pending', textContent: 'The beds themselves are made by MusicGen, grown from this guide hummed: never from words alone, and never without a guide. They are sound, kept in the Archive, and are not drawn here.' })),
  )
}
