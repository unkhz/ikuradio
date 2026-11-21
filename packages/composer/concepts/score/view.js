// The page of the Score: sample words fitted to their phrases, each syllable on its note on the sixteenth grid at a tempo and
// rate, and the Song's age, which grows on the reciting note when the words outgrow the phrase.

function drawConcept(root, data) {
  const section = (title, ...children) => el('section', { className: 'block-section' }, el('h2', { textContent: title }), ...children)
  const input = el('input', { type: 'number', min: 20, max: 300, step: 1, value: data.tempo })

  const line = (item) => {
    const shown = item.fitted ?? item.phrase
    const verdict = item.fits ? (item.grown ? `fitted, with ${item.grown} bar${item.grown > 1 ? 's' : ''} of grace on its reciting note` : 'fitted in its own bars') : 'does not fit its bars: the mind would be asked again'
    return el(
      'div',
      { className: `line${item.fits ? '' : ' unfit'}` },
      el('div', { className: 'facts', textContent: `${item.words.map((word) => word.text).join(' ')}: ${item.syllables} syllables, ${verdict}` }),
      el('div', { className: 'roll-box' }, rollSvg({ phrases: [shown], captions: item.captions, grid: true, sixteenths: true, beat: data.scale.beat })),
    )
  }
  const age = (item) =>
    el(
      'div',
      { className: 'line' },
      el('div', { className: 'facts', textContent: `iteration ${item.iteration}: ${item.text.replace(/[,.]+$/, '')}${item.grownBars === undefined ? ': does not fit' : item.grownBars ? `, grown ${item.grownBars} bar${item.grownBars > 1 ? 's' : ''} on the reciting note` : ': fits its phrase'}` }),
      el('div', { className: 'roll-box' }, rollSvg({ phrases: [item.fitted ?? item.phrase], captions: item.captions, grid: true, sixteenths: true, beat: data.scale.beat })),
    )

  const ask = async () => {
    const tempo = Math.min(300, Math.max(20, Math.floor(Number(input.value) || 72)))
    drawConcept(root, await fetch(`/score.json?tempo=${tempo}`).then((r) => r.json()))
  }
  input.addEventListener('change', ask)
  root.replaceChildren(
    el('div', { className: 'controls' }, el('label', {}, 'Tempo ', input, ' bpm')),
    section('The grid', el('p', { className: 'facts', textContent: `A bar is sixteen sixteenths, and two syllables begin at least ${data.k} of them apart, so that none comes sooner than ${(1 / data.rate).toFixed(2)} seconds after the one before at ${data.tempo} beats a minute and ${data.rate} syllables a second. The faint lines are the sixteenths, the stronger the beats, the strongest the bars. A word stands under the note its first syllable is on, and a dash under each note that carries the rest of it. Words in italics are not in the dictionary, and their syllables are counted by a rough rule.` })),
    section('Four lines, each to its phrase', ...data.lines.map(line)),
    section(`The Song's age on the first phrase of the ${data.ageIn}`, ...data.age.map(age)),
  )
}
