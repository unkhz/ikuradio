// The page of the Tune: its own phrases, by the names the Tune gives them, as a piano roll (degree up, beats along, a ringed
// note the one a long line may be chanted on); the ones that evolve a step at a time from Song to Song, and the ones that
// stay; and the Variations of one Song. The headings are the Tune's own keys, from the data.

function drawBody(root, data) {
  const section = (title, ...children) => el('section', { className: 'block-section' }, el('h2', { textContent: title }), ...children)
  const roll = (phrases) => el('div', { className: 'roll-box' }, rollSvg({ phrases, changed: phrases.map((phrase) => phrase.changed), grid: true }))
  const legend = el('p', { className: 'facts', textContent: 'Each bar is a note: its height the scale degree it is sung on, its length its beats. A ringed note is the one a long line may be chanted on; a gap is a rest. Coral notes are the ones that moved.' })

  // each key of the tune, as the Tune names it, as it was born
  const born = data.names.map((name) =>
    section(
      name,
      roll(data.born[name]),
      el('p', { className: 'facts', textContent: data.stays.includes(name) ? `It stays: after ${data.evolution.length - 1} Songs of evolving the tune it is exactly as it was born.` : 'It evolves, from Song to Song: see below.' }),
    ),
  )
  // the keys that move, a Song at a time
  const evolving = data.evolves.map((name) =>
    section(
      `${name}, Song by Song`,
      el('p', { className: 'facts', textContent: `Every Song, each phrase of the ${name} takes one small step: a note moves to its neighbour in the scale, or its length changes.` }),
      ...data.evolution.map((step) => el('div', { className: 'step' }, el('div', { className: 'facts', textContent: step.step ? `${step.step} Song${step.step > 1 ? 's' : ''} on` : 'as it was born' }), roll(step.tunes[name]))),
    ),
  )
  const varying = data.varies.map((name) =>
    section(
      `${name}, in a Song's Variations`,
      el('p', { className: 'facts', textContent: 'Within one Song the tune takes turns: the first is the tune itself, and each of the others ornaments a phrase or two, never building on another Variation.' }),
      ...data.variations.map((variation) => el('div', { className: 'step' }, el('div', { className: 'facts', textContent: variation.variation ? `Variation ${variation.variation + 1}` : 'the tune itself' }), roll(variation.tunes[name]))),
    ),
  )
  root.replaceChildren(legend, ...born, ...evolving, ...varying)
}
