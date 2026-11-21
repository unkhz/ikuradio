// The page of the Lyrics: the fields the mind writes, where an Arrangement sings each, how many syllables each line carries
// at a tempo as slots that wordiness fills, and the Song's age, the line the mind does not write, growing.

function drawConcept(root, data) {
  const section = (title, ...children) => el('section', { className: 'block-section' }, el('h2', { textContent: title }), ...children)

  const fillOf = (field) => data.fills.filter((fill) => fill.field === field).map((fill) => fill.instance)
  const fields = el(
    'table',
    {},
    el('thead', {}, el('tr', {}, ...['field', 'sung in these instances'].map((name) => el('th', { textContent: name })))),
    el('tbody', {}, ...data.fields.map((field) => el('tr', {}, el('td', { textContent: field }), el('td', { textContent: fillOf(field).join(', ') })))),
  )

  /** A line's count as slots: those it is meant to have filled, those it may have at most outlined. */
  const slots = (count) =>
    el(
      'span',
      { className: 'slots', title: `${count.target} meant, at most ${count.most}${count.grows ? ', and it grows on its reciting note' : ''}` },
      ...Array.from({ length: count.most }, (_, i) => el('i', { className: i < count.target ? 'on' : '' })),
      count.grows ? el('em', { textContent: ' + bars' }) : '',
    )
  const counts = data.lines.map((part) =>
    el(
      'div',
      { className: 'count-block' },
      el('h3', { textContent: part.part, style: `color:${colour(part.part)}` }),
      el('table', {}, el('thead', {}, el('tr', {}, el('th', { textContent: 'line' }), ...part.lines[0].counts.map((count) => el('th', { textContent: `wordiness ${count.wordiness}` })))), el('tbody', {}, ...part.lines.map((line) => el('tr', {}, el('td', { textContent: line.line + 1 }), ...line.counts.map((count) => el('td', {}, slots(count), el('small', { textContent: ` ${count.target} of ${count.most}` }))))))),
    ),
  )

  const ages = el(
    'table',
    {},
    el('thead', {}, el('tr', {}, ...['iteration', 'the line', 'syllables', 'bars it grows'].map((name) => el('th', { textContent: name })))),
    el('tbody', {}, ...data.age.map((age) => el('tr', {}, el('td', { textContent: age.iteration }), el('td', { textContent: age.text }), el('td', { textContent: `${age.rough ? 'about ' : ''}${age.syllables}` }), el('td', {}, age.grown === undefined ? 'does not fit' : el('span', { className: 'slots' }, ...Array.from({ length: Math.max(1, age.grown) }, (_, i) => el('i', { className: age.grown > i ? 'on' : '' })), el('small', { textContent: ` ${age.grown}` })))))),
  )

  root.replaceChildren(
    section('What the mind writes', el('p', { className: 'facts', textContent: `Five fields, filled for an iteration, each from the one in the same place before it. ${data.arrangement ? `Here they are sung as the Arrangement "${data.arrangement}" lays them out:` : ''}` }), fields),
    section('How many syllables a line carries', el('p', { className: 'facts', textContent: `At ${data.tempo} beats a minute, ${data.rate} syllables a second at the most. Filled slots are what a line is meant to have; outlined, the most its phrase can carry. Wordiness moves the meant count between sparse and full.` }), ...counts),
    section("The Song's age", el('p', { className: 'facts', textContent: `The first line of the ${data.ageIn} is not the mind's to write: it is how long the song has been going, and has more syllables every year, so it grows past its phrase, a bar at a time, on the note it is chanted on.${data.age.some((age) => age.rough) ? ' (A word the dictionary does not know has its syllables counted by a rough rule.)' : ''}` }), ages),
  )
}
