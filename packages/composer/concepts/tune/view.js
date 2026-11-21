// The page of the Tune: its phrases as a piano roll (degree up, beats along, a ringed note the one a long line is chanted on),
// the tune evolving a step at a time from Song to Song while its refrain stays, and the Variations of one Song.

function drawConcept(root, data) {
  const section = (title, ...children) => el('section', { className: 'block-section' }, el('h2', { textContent: title }), ...children)
  const roll = (phrases, changed) => el('div', { className: 'roll-box' }, rollSvg({ phrases, changed, grid: true }))
  const legend = el('p', { className: 'facts', textContent: 'Each bar is a note: its height the scale degree it is sung on, its length its beats. A ringed note is the one a long line may be chanted on; a gap is a rest. Coral notes are the ones that moved.' })

  root.replaceChildren(
    section('The refrain', legend, roll(data.refrain), el('p', { className: 'facts', textContent: data.refrainStays ? `It stays: after ${data.evolution.length - 1} Songs of evolving it is exactly the tune it was born with.` : 'It moves.' })),
    section(
      'The other phrases, Song by Song',
      el('p', { className: 'facts', textContent: 'Every Song, each of these phrases takes one small step: a note moves to its neighbour in the scale, or its length changes. Between Songs only these move.' }),
      ...data.evolution.map((step) => el('div', { className: 'step' }, el('div', { className: 'facts', textContent: step.step ? `${step.step} Song${step.step > 1 ? 's' : ''} on` : 'as it was born' }), roll(step.phrases, step.phrases.map((phrase) => phrase.changed)))),
    ),
    section(
      "A Song's Variations",
      el('p', { className: 'facts', textContent: "Within one Song the tune takes turns: the first is the tune itself, and each of the others ornaments a phrase or two, never building on another Variation." }),
      ...data.variations.map((variation) => el('div', { className: 'step' }, el('div', { className: 'facts', textContent: variation.variation ? `Variation ${variation.variation + 1}` : 'the tune itself' }), roll(variation.phrases, variation.phrases.map((phrase) => phrase.changed)))),
    ),
  )
}
