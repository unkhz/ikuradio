// What the Arrangement's two pages share: the drawing of an Arrangement as a session (plan "Evolution of Song", step 10): the ruler in
// seconds, the regions, the tempo, a lane for each Track and the Blocks on them, and the key and the table beneath. Learn draws it to explain;
// Edit draws the same to work on. Everything it draws, the server worked out; it names no part and no Track.

// ---- drawing a layout, in the viewer and in the editor

/** A letter for each of the things named, in the order they first appear: A to Z, then a to z. */
const lettersFor = (names) => {
  const letters = new Map()
  for (const name of names) if (!letters.has(name)) letters.set(name, String.fromCharCode((letters.size % 52 < 26 ? 65 : 71) + (letters.size % 52)))
  return letters
}

/** A letter for each region that has words, by index: regions of one name in one iteration share one, and a name after a turn has a letter of its own. */
function wordsLetters(layout) {
  const named = lettersFor(layout.instances.filter((instance) => instance.words === 'written').map((instance) => `${instance.iteration}:${instance.name}`))
  return new Map(layout.instances.filter((instance) => instance.words === 'written').map((instance) => [instance.index, named.get(`${instance.iteration}:${instance.name}`)]))
}

/**
 * A mark for each Block's key, numbered within its Track and led by the shortest start of the Track's name that no other Track's shares: the first
 * sound of one Track is its 1, the second its 2. They can't be read as a region's letter, which says the words.
 */
function marksFor(timeline) {
  const ids = timeline.tracks.map((track) => track.id)
  const lead = (id) => {
    for (let n = 1; n <= id.length; n++) if (ids.filter((other) => other.startsWith(id.slice(0, n))).length === 1) return id.slice(0, n)
    return id
  }
  const marks = new Map()
  for (const track of timeline.tracks) {
    const keys = []
    for (const block of timeline.blocks) if (block.track === track.id && !keys.includes(block.key)) keys.push(block.key)
    keys.forEach((key, i) => marks.set(key, `${lead(track.id)}${i + 1}`))
  }
  return marks
}

/** A clock's m:ss for a ruler's tick. */
const clock = (value) => `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`

/** Greedy sub-rows for the Blocks of one Track, so that two that overlap in time are not drawn on one another: each Block's row, from 0. */
function rowsOf(blocks) {
  const ends = []
  const rows = new Map()
  for (const block of [...blocks].sort((a, b) => a.startSeconds - b.startSeconds || a.index - b.index)) {
    let row = ends.findIndex((end) => end <= block.startSeconds + 1e-9)
    if (row < 0) row = ends.length
    ends[row] = block.endSeconds
    rows.set(block, row)
  }
  return rows
}

const labelWidth = 128
const rowHeight = 30

/**
 * Draws the timeline as a session is drawn: the ruler in seconds with the bars where there is a tempo, the regions coloured by part, a lane for the
 * tempo with free time drawn as free, a lane for each Track with its Blocks coloured by key (the same letter is the same sound, made once),
 * overlaps stacked and fades drawn as ramps. Everything it draws, the server worked out: `layout` for what a region is, `timeline` for where.
 */
function drawSession(layout, timeline, diagram, scroll, edit) {
  if (!timeline || timeline.refusal) {
    diagram.replaceChildren(el('p', { className: 'about', textContent: timeline?.refusal ?? 'There is no timeline to draw.' }))
    return
  }
  // as wide as the page can read it, and no narrower than a second can be seen
  const room = scroll.clientWidth - labelWidth - 24
  const pps = Math.max(2.2, (room / Math.max(1, timeline.seconds)) * (edit?.zoom ?? 1))
  // what a mouse needs to turn a place on the drawing back into seconds
  diagram.dataset.pps = pps
  diagram.dataset.label = labelWidth
  const selected = (kind, index) => edit?.selection?.kind === kind && edit.selection.index === index
  const refused = (kind, index) => edit?.refused?.thing === kind && edit.refused.index === index
  const width = timeline.seconds * pps + 36
  const x = (value) => value * pps
  diagram.style.setProperty('--session', `${width}px`)
  diagram.style.width = `${labelWidth + width}px`

  const lane = (className, label, ...more) => {
    const canvas = el('div', { className: 'canvas' })
    canvas.style.width = `${width}px`
    return { canvas, row: el('div', { className: `lane ${className}` }, el('div', { className: 'label' }, ...label), canvas, ...more) }
  }
  const place = (node, from, to) => {
    node.style.left = `${x(from)}px`
    node.style.width = `${Math.max(1, x(to - from))}px`
    return node
  }

  // the ruler: ticks every so often, to a step that is far enough apart to read
  const ruler = lane('ruler', [el('span', { textContent: 'seconds' })])
  const step = [1, 2, 5, 10, 15, 30, 60, 120].find((candidate) => candidate * pps >= 64) ?? 120
  for (let t = 0; t <= timeline.seconds + 1e-9; t += step) ruler.canvas.append(Object.assign(el('span', { className: 'tick', textContent: clock(t) }), { style: `left:${x(t)}px` }))

  // the regions, coloured by part, the words that are sung more than once marked alike by a letter
  const letters = wordsLetters(layout)
  const regions = lane('regions', [el('span', { textContent: 'regions' })])
  for (const region of timeline.regions) {
    const instance = layout.instances[region.index]
    const box = place(el('div', { className: 'region' }), region.startSeconds, region.startSeconds + region.seconds)
    box.dataset.name = region.name
    box.dataset.index = region.index
    if (selected('region', region.index)) box.classList.add('selected')
    if (refused('instance', region.index)) box.classList.add('refused')
    box.style.background = colour(region.part)
    box.title = `${region.name}: a ${region.part}, from ${seconds(region.startSeconds)} for ${seconds(region.seconds)}${region.tempo === null ? ', in free time' : `, at ${region.tempo} beats a minute`}${instance?.grows ? `; ${growsWords}` : ''}`
    box.append(el('div', { className: 'name', textContent: region.name }), el('div', { className: 'what', textContent: `${region.part} · ${seconds(region.seconds)}` }))
    if (instance && instance.words === 'written') {
      const followed = instance.continues !== undefined ? layout.instances[instance.continues] : undefined
      box.append(el('div', { className: 'words', textContent: `${followed ? '↩ ' : ''}${letters.get(instance.index)}`, title: followed ? `Goes on with the words of region ${followed.index + 1}, which were sung before the turn` : 'The same letter, in the same iteration: the same words' }))
    }
    if (instance) box.append(el('span', { className: `end ${instance.ending}`, title: instance.ending === 'full' ? 'ends at home' : 'ends open, on the fifth' }))
    if (edit && region.tempo === null) box.append(Object.assign(el('span', { className: 'seconds-grip', title: 'Drag the right edge to set its seconds' }), { style: 'position:absolute;top:0;bottom:0;right:0;width:8px;background:rgba(0,0,0,0.25);cursor:ew-resize' }))
    box.addEventListener('mouseenter', () => diagram.querySelectorAll('.region').forEach((other) => other.dataset.name === region.name && other.classList.add('lit')))
    box.addEventListener('mouseleave', () => diagram.querySelectorAll('.region').forEach((other) => other.classList.remove('lit')))
    regions.canvas.append(box)
  }

  // the tempo lane: a stretch under a tempo has its bars, a stretch in free time has none
  const tempoLane = lane('pace', [el('span', { textContent: 'tempo' })])
  for (const segment of timeline.segments) {
    const stretch = place(el('div', { className: segment.tempo === null ? 'stretch free' : 'stretch' }), segment.from, segment.to)
    const roomy = x(segment.to - segment.from) >= 120
    // in Edit a change of tempo has its flag, which says its value: the stretch says it only where there is none, and free time is the hatching and a single word
    const flagged = (edit?.tempoPoints ?? []).some((point) => timeline.regions[point.at] && Math.abs(timeline.regions[point.at].startSeconds - segment.from) < 1e-6)
    stretch.textContent = flagged ? '' : segment.tempo === null ? (roomy ? `free time · ${seconds(segment.to - segment.from)}` : 'free') : `${segment.tempo} bpm`
    stretch.title = segment.tempo === null ? 'No beat and no grid: this stretch lasts as long as it is given' : `${seconds(segment.to - segment.from)} under one tempo, its bars drawn`
    tempoLane.canvas.append(stretch)
    if (segment.tempo !== null) {
      const bar = (timeline.beatsPerBar * 60) / segment.tempo
      if (bar * pps >= 7) for (let t = segment.from; t < segment.to - 1e-9; t += bar) tempoLane.canvas.append(Object.assign(el('span', { className: 'bar' }), { style: `left:${x(t)}px` }))
    }
  }

  // in Edit, a flag for each change of tempo, where it is, to be picked up
  for (const point of edit?.tempoPoints ?? []) {
    const region = timeline.regions[point.at]
    if (!region) continue
    const flag = el('div', { className: `point${selected('tempo', point.index) ? ' selected' : ''}${refused('tempo', point.index) ? ' refused' : ''}`, title: 'A change of tempo: click to choose it, drag it to another region' }, el('span', { textContent: point.bpm === null ? 'free' : point.bpm === 'mood' ? `${region.tempo ?? ''} bpm` : `${point.bpm} bpm` }))
    flag.dataset.point = point.index
    flag.style.left = `${x(region.startSeconds)}px`
    tempoLane.canvas.append(flag)
  }

  // the Tracks, a lane each, and on them the Blocks
  const keys = marksFor(timeline)
  const lanes = [ruler, regions, tempoLane]
  for (const track of timeline.tracks) {
    const mine = timeline.blocks.filter((block) => block.track === track.id)
    const rows = rowsOf(mine)
    const stacked = Math.max(1, ...[...rows.values()].map((row) => row + 1))
    const made = track.makes ? `${track.makes.by}, from ${track.makes.from}` : 'makes nothing yet'
    const one = lane(`track${track.makes ? '' : ' empty'}${track.heard ? '' : ' silent'}`, [el('strong', { textContent: track.title || track.id }), el('small', { textContent: track.heard ? made : `${made} · not heard` })])
    one.row.dataset.track = track.id
    one.canvas.style.height = `${stacked * rowHeight + 6}px`
    if (!track.makes) one.canvas.append(el('div', { className: 'nothing', textContent: 'nothing makes this yet: nothing is drawn' }))
    for (const block of mine) {
      const box = place(el('div', { className: 'clip' }), block.startSeconds, block.endSeconds)
      box.style.top = `${3 + rows.get(block) * rowHeight}px`
      box.style.background = colour(block.key)
      box.dataset.key = block.key
      box.dataset.block = block.index
      if (selected('block', block.index)) box.classList.add('selected')
      if (refused('block', block.index)) box.classList.add('refused')
      box.title = `${block.key}: from ${seconds(block.startSeconds)} to ${seconds(block.endSeconds)}${block.gain !== 1 ? `, at gain ${block.gain}` : ''}${block.fadeIn ? `, fading in over ${seconds(block.fadeIn)}` : ''}${block.fadeOut ? `, fading out over ${seconds(block.fadeOut)}` : ''}${block.source.length ? `, made from ${block.source.join(', ')}` : ''}`
      box.append(el('span', { className: 'letter', textContent: keys.get(block.key) }), el('span', { className: 'source', textContent: block.source[0] ?? '' }))
      for (const [side, fade] of [['in', block.fadeIn], ['out', block.fadeOut]]) {
        if (!fade) continue
        const ramp = el('span', { className: `ramp ${side}` })
        ramp.style.width = `${Math.min(x(block.seconds), x(fade))}px`
        box.append(ramp)
      }
      if (edit) {
        // the hands of a Block: its ends to stretch it, the corners of its fades, the line of its gain
        for (const side of ['left', 'right']) {
          const grip = el('span', { className: `grip ${side}`, title: 'Drag to stretch' })
          grip.dataset.grip = side
          box.append(grip)
        }
        const allows = (name) => track.parameters?.some((parameter) => parameter.name === name)
        for (const [side, name, fade] of [['in', 'fadeIn', block.fadeIn], ['out', 'fadeOut', block.fadeOut]]) {
          if (!allows(name)) continue
          const handle = el('span', { className: `fade-handle ${side}`, title: `Drag for the fade ${side}` })
          handle.dataset.fade = name
          handle.style[side === 'in' ? 'left' : 'right'] = `${Math.min(x(block.seconds), x(fade ?? 0))}px`
          box.append(handle)
        }
        if (allows('gain')) {
          const gain = track.parameters.find((parameter) => parameter.name === 'gain')
          const line = el('span', { className: 'gain-line', title: `Drag for the gain: ${block.gain}` })
          line.dataset.gain = 'gain'
          line.style.top = `${Math.round((1 - block.gain / (gain.maximum ?? 2)) * 22)}px`
          box.append(line)
        }
      }
      box.addEventListener('mouseenter', () => diagram.querySelectorAll('.clip').forEach((other) => other.dataset.key === block.key && other.classList.add('lit')))
      box.addEventListener('mouseleave', () => diagram.querySelectorAll('.clip').forEach((other) => other.classList.remove('lit')))
      one.canvas.append(box)
    }
    lanes.push(one)
  }

  // where the words turn over, a line down through every lane
  const turns = timeline.turns.map(({ seconds: at, iteration }) => {
    const line = el('div', { className: 'turn', title: `The words turn over here: iteration ${iteration + 1} begins` }, el('span', { textContent: `turn → ${iteration + 1}` }))
    line.style.left = `${labelWidth + x(at)}px`
    return line
  })
  // in Edit the turns have handles on the ruler, to be dragged from region to region
  for (const turn of edit?.turnBoundaries ?? []) {
    const at = turn.boundary < timeline.regions.length ? timeline.regions[turn.boundary].startSeconds : timeline.seconds
    const handle = el('div', { className: `turn-handle${selected('turn', turn.index) ? ' selected' : ''}${refused('turn', turn.index) ? ' refused' : ''}`, title: 'The words turn over here: click to choose it, drag it to another boundary' }, el('span', { textContent: '↻' }))
    handle.dataset.turn = turn.index
    handle.style.left = `${x(at)}px`
    ruler.canvas.append(handle)
  }
  diagram.replaceChildren(...lanes.map(({ row }) => row), ...turns)
  // a lane's canvas is told which kind it is, for a mouse that draws on it
  for (const { row, canvas } of lanes) canvas.dataset.lane = [...row.classList].find((name) => ['ruler', 'regions', 'pace', 'track'].includes(name)) ?? ''
  for (const { row, canvas } of lanes) if (row.dataset.track) canvas.dataset.track = row.dataset.track
}

/** Draws a layout into a view: its timeline, its key and its table, and says how long it is. */
const drawn = new Map()

function draw(layout, timeline, views) {
  const resolved = timeline && !timeline.refusal ? timeline.regions : undefined
  drawn.set(views, [layout, timeline])
  const { scroll, diagram, key, order, total } = views
  const length = timeline && !timeline.refusal ? timeline.seconds : layout.seconds
  const iterations = timeline && !timeline.refusal && timeline.iterations > 1 ? ` · ${timeline.iterations} iterations` : ''
  total.textContent = `${layout.instances.length} parts · ${seconds(length)}${iterations}`
  drawSession(layout, timeline, diagram, scroll, views.edit?.())
  // the words that are sung more than once are marked alike, by a letter, in the order they first appear
  const letters = wordsLetters(layout)

  // the key: each part in its colour, and what the marks say
  const used = [...new Set(layout.instances.map((i) => i.part))]
  key.replaceChildren(
    ...used.map((id) => el('li', {}, Object.assign(el('span', { className: 'swatch' }), { style: `background:${colour(id)}` }), id)),
    el('li', {}, el('span', { className: 'end full' }), 'ends at home'),
    el('li', {}, el('span', { className: 'end' }), 'ends open'),
    el('li', {}, 'on a region, the same letter: the same words, within an iteration'),
    el('li', {}, '↩ on a region: it goes on with the words of the one it follows, across a turn'),
    el('li', {}, 'on a Block, the same mark (a Track\'s initial and a number): the same sound, made once'),
    el('li', {}, 'a ramp: a fade'),
    el('li', {}, 'a turn: the words turn over, and the Song is a number older'),
  )

  // and in order, in words, for what the blocks are too narrow to say
  const row = (cells, tag = 'td') => el('tr', {}, ...cells.map((cell) => el(tag, { textContent: cell })))
  order.replaceChildren(
    el('thead', {}, row(['#', 'name', 'part', 'from', 'lasts', 'beats', 'tempo', 'ends', 'words / journey'], 'th')),
    el(
      'tbody',
      {},
      ...layout.instances.map((i) =>
        row([
          i.index + 1,
          i.name,
          i.part,
          seconds(resolved ? resolved[i.index].startSeconds : i.startSeconds),
          seconds(resolved ? resolved[i.index].seconds : i.seconds),
          resolved && resolved[i.index].tempo === null ? 'free' : (resolved ? resolved[i.index].beats : i.beats),
          resolved ? (resolved[i.index].tempo === null ? 'free' : `${resolved[i.index].tempo} bpm`) : `${layout.tempo} bpm`,
          i.ending === 'full' ? 'at home' : 'open',
          i.words === 'none'
            ? `hums from ${i.before ?? 'the start'} to ${i.after ?? 'the end'}`
            : `${letters.get(i.index)}${i.heardAgain.length ? `, again at ${i.heardAgain.map((n) => n + 1).join(', ')}` : ', once'}${i.continues !== undefined ? `; goes on from ${i.continues + 1}` : ''}${i.grows ? `; ${growsWords}` : ''}`,
        ]),
      ),
    ),
  )
}

// as wide as the page can read it: drawn again when the page is a different width
let widthWas = window.innerWidth
window.addEventListener('resize', () => {
  if (window.innerWidth === widthWas) return
  widthWas = window.innerWidth
  for (const [views, [layout, timeline]] of drawn) drawSession(layout, timeline, views.diagram, views.scroll, views.edit?.())
})
