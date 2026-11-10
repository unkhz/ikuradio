// The song serves this page itself, so it is found where the page came from.
// Served separately for development (task ui:dev), it is found next door.
const server =
  location.port === '4000' ? `http://${location.hostname}:3000` : ''

function createAudioElement(file, volume) {
  const audioEl = document.createElement('audio')
  audioEl.src = `${server}/${file}`
  audioEl.volume = volume
  audioEl.crossOrigin = 'anonymous'
  return audioEl
}

function createGain(audioContext, gainValue) {
  const gain = audioContext.createGain()
  gain.gain.value = gainValue
  return { in: gain, gain, out: gain }
}

function createTrack(audioContext, audioEl, gainValue) {
  const track = audioContext.createMediaElementSource(audioEl)
  const gain = createGain(audioContext, gainValue)
  track.connect(gain.in)
  return { in: track, gain: gain.in, out: gain.out }
}

function createDelay(audioContext, delayValue, gainValue) {
  // Now, create a gain node (to control the volume of the echo)
  const gain = createGain(audioContext, gainValue)

  // And a delay node
  const delay = audioContext.createDelay(60)
  delay.delayTime.value = delayValue
  delay.connect(gain.in)

  // Connect the gain back to the delay to create a feedback loop
  gain.out.connect(delay)

  return { in: delay, gain: gain.in, out: gain.out }
}

function createCompressor(audioContext) {
  // Add compressor to keep constant volume
  const compressor = audioContext.createDynamicsCompressor()
  compressor.threshold.value = -50
  compressor.knee.value = 10
  compressor.ratio.value = 18
  compressor.attack.value = 0.1
  compressor.release.value = 0.2

  return { in: compressor, out: compressor }
}

function startCrossfade(
  audioContext,
  oldTrack,
  newTrack,
  durationSeconds,
  targetGainValue,
) {
  newTrack.gain.gain.setValueAtTime(0, audioContext.currentTime)

  // When the startCrossfade starts, reduce the volume of source 1 to 0 and increase the volume of source 2 to 1
  oldTrack.gain.gain.linearRampToValueAtTime(
    0,
    audioContext.currentTime + durationSeconds,
  )
  newTrack.gain.gain.linearRampToValueAtTime(
    targetGainValue,
    audioContext.currentTime + durationSeconds,
  )
}

// The voices. Every voice goes to the speakers, and an echo of it follows
// half a second behind, fading. In 2023 only the echo was connected.
let voiceBus
function voices(audioContext) {
  if (!voiceBus) {
    voiceBus = audioContext.createGain()
    const echo = createDelay(audioContext, 0.5, 0.22)
    voiceBus.connect(audioContext.destination)
    voiceBus.connect(echo.in)
    echo.out.connect(audioContext.destination)
  }
  return voiceBus
}

// Recordings, fetched and decoded before they are needed, by name.
const recordings = new Map()
function prepare(audioContext, file) {
  if (!recordings.has(file)) {
    recordings.set(
      file,
      fetch(`${server}/${file}`)
        .then((response) => response.arrayBuffer())
        .then((data) => audioContext.decodeAudioData(data)),
    )
  }
  return recordings.get(file)
}

// Plays a recording at a moment on the page's own clock. If the moment has
// already passed, the recording joins where it would be now, on the beat.
function playAt(audioContext, buffer, when) {
  const now = audioContext.currentTime
  const late = now - when
  if (late >= buffer.duration) return
  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.connect(voices(audioContext))
  if (late > 0) source.start(now, late)
  else source.start(when)
}

// Plays a cued recording at once, and does not keep it: it belongs to no score.
function playVoice(audioContext, audioSrc) {
  prepare(audioContext, audioSrc).then((buffer) => {
    recordings.delete(audioSrc)
    playAt(audioContext, buffer, audioContext.currentTime)
  })
}

// The page keeps time. Scores arrive long before their iteration begins;
// when one begins, every line is placed at its moment on the page's clock.
const scores = new Map()
let keptTime // the iteration whose voices the page has placed itself
const lead = 0.05 // seconds between hearing a beginning and the first sound

function receiveScore(audioContext, score) {
  scores.set(score.iteration, score)
  for (const { file } of score.lines) prepare(audioContext, file)
}

function begin(audioContext, iteration) {
  const score = scores.get(iteration)
  // forget what has been sung: its scores and its recordings
  for (const [name, old] of scores) {
    if (BigInt(name) < BigInt(iteration)) {
      scores.delete(name)
      for (const { file } of old.lines) recordings.delete(file)
    }
  }
  if (!score) {
    // arrived too late to prepare this one; follow the cues until the next
    keptTime = undefined
    return
  }
  keptTime = iteration
  const begins = audioContext.currentTime + lead
  for (const { file, at } of score.lines) {
    prepare(audioContext, file).then((buffer) =>
      playAt(audioContext, buffer, begins + at),
    )
  }
}

let oldMusicTrack
function playMusic(audioContext, audioSrc) {
  const audioEl = createAudioElement(audioSrc, 1)
  const track = createTrack(audioContext, audioEl, 1)

  if (oldMusicTrack) {
    startCrossfade(audioContext, oldMusicTrack, track, 3, 1)
  }

  // const delay = createDelay(audioContext, 1, 0.33)
  const compressor = createCompressor(audioContext)
  const masterGain = createGain(audioContext, 0.15)
  track.out.connect(compressor.in)
  compressor.out.connect(masterGain.in)
  masterGain.out.connect(audioContext.destination)

  audioEl.addEventListener('ended', () => {
    audioEl.remove()
  })
  audioEl.play()
  oldMusicTrack = track
}

// The words. Every part of the song is its own paragraph, and the words are
// only ever added as text: whatever the mind writes is shown, never obeyed.
let el
function switchStoryElement(parent, kind = 'verse') {
  el = document.createElement('p')
  el.className = kind
  parent.appendChild(el)
}
function appendStoryElement(text) {
  const last = el.lastChild
  if (last && last.nodeType === Node.TEXT_NODE) last.appendData(text)
  else el.appendChild(document.createTextNode(text))
}
function breakLine() {
  // a line ends; a part that has already ended needs no second break
  const last = el.lastChild
  if (last && last.nodeName !== 'BR')
    el.appendChild(document.createElement('br'))
}

// A quiet line at the edge of the page: how old the song is, and what it is.
function describeIteration(about) {
  const status = document.getElementById('status')
  const age = BigInt(about.iteration).toLocaleString('en')
  status.replaceChildren(
    Object.assign(document.createElement('span'), {
      className: 'age',
      textContent: `iteration ${age}`,
    }),
    document.createTextNode(
      ` · ${about.mood.join(' + ')} · ${about.mode}, ${about.tempo} bpm · ${about.choir}`,
    ),
  )
  status.title = `variation ${about.variation + 1}`
}

// Looking back. The diary remembers every iteration ever sung; anyone may
// leaf back through it, a few pages at a time, newest first.
const pageSize = 12

function textParagraph(kind, lines) {
  const p = document.createElement('p')
  p.className = kind
  lines.forEach((line, i) => {
    if (i > 0) p.appendChild(document.createElement('br'))
    p.appendChild(document.createTextNode(line))
  })
  return p
}

function renderPage(page) {
  const article = document.createElement('article')
  const heading = document.createElement('h2')
  heading.textContent = `iteration ${BigInt(page.iteration).toLocaleString('en')}`
  const when = new Date(page.written)
  const details = [
    page.mood.join(' + '),
    `${page.mode}, ${page.tempo} bpm`,
    page.choir,
    isNaN(when) ? undefined : when.toLocaleString(),
  ].filter(Boolean)
  article.append(heading, textParagraph('weather', [details.join(' · ')]))
  for (const part of page.parts) {
    article.appendChild(textParagraph(part.type, part.content.split('\n')))
  }
  return article
}

async function leafBack(before) {
  const pages = document.getElementById('pages')
  const older = document.getElementById('older')
  older.hidden = true
  const query = before
    ? `?before=${before}&count=${pageSize}`
    : `?count=${pageSize}`
  try {
    const found = await fetch(`${server}/diary${query}`).then((r) => r.json())
    if (!before && found.length === 0) {
      pages.appendChild(
        textParagraph('weather', ['nothing has been sung to the end yet']),
      )
    }
    found.forEach((page) => pages.appendChild(renderPage(page)))
    if (found.length === pageSize) {
      older.hidden = false
      older.onclick = () => leafBack(found.at(-1).iteration)
    }
  } catch {
    pages.appendChild(
      textParagraph('weather', ['~ the diary cannot be reached ~']),
    )
  }
}

function openDiary() {
  document.getElementById('pages').replaceChildren()
  document.getElementById('diary').hidden = false
  document.body.classList.add('looking-back')
  leafBack()
}

function closeDiary() {
  document.getElementById('diary').hidden = true
  document.body.classList.remove('looking-back')
}

document.getElementById('look-back').addEventListener('click', openDiary)
document.getElementById('close-diary').addEventListener('click', closeDiary)
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDiary()
})

let isScrolling = false
window.addEventListener('scroll', () => {
  isScrolling = true
  setTimeout(() => {
    isScrolling = false
  }, 3000)
})

shouldFollowStory = (threshold = 100) => {
  const el = document.scrollingElement
  const scrollSize = Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop)
  const isAtBottom = scrollSize < threshold
  return !isScrolling && isAtBottom
}

// Listens until the song can no longer be heard, then waits for it to be
// heard again. The page waits for the song the way the song waits for its
// mind: patiently, asking again every few seconds, forever.
async function listen() {
  document.getElementById('controls').style.display = 'none'
  const output = document.getElementById('output')
  const audioContext = new AudioContext()
  for (;;) {
    try {
      await read(output, audioContext)
    } catch {
      // the room went quiet: the server stopped, or the way to it did
    }
    // the song may already have said it was resting; then the quiet is no news
    const last = output.lastChild?.textContent ?? ''
    if (last !== quiet && !/^~ the song is resting/.test(last)) {
      switchStoryElement(output, 'weather')
      appendStoryElement(quiet)
    }
    keptTime = undefined
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}

const quiet = '~ the room is quiet ~'

async function read(output, audioContext) {
  const response = await fetch(`${server}/listen`)
  if (!response.body) return
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let unfinished = ''
  let isSnapshot = true
  switchStoryElement(output)

  function hear(utterance) {
    if (utterance.startsWith('score:')) {
      receiveScore(audioContext, JSON.parse(utterance.slice(6)))
    } else if (utterance.startsWith('begin:')) {
      begin(audioContext, utterance.slice(6))
    } else if (utterance.startsWith('play:')) {
      const audioSrc = utterance.slice(5)
      if (isSnapshot) return
      if (audioSrc.startsWith('audio/vocals')) {
        // the page places its own voices when it keeps time
        if (keptTime === undefined) playVoice(audioContext, audioSrc)
      } else {
        playMusic(audioContext, audioSrc)
      }
    } else if (utterance.startsWith('about:')) {
      describeIteration(JSON.parse(utterance.slice(6)))
    } else if (utterance.startsWith('rest:')) {
      switchStoryElement(output, 'weather')
      appendStoryElement(`~ ${utterance.slice(5)} ~`)
    } else if (utterance.startsWith('weather:')) {
      switchStoryElement(output, 'weather')
      appendStoryElement(`~ ${utterance.slice(8)} ~`)
    } else if (utterance.startsWith('part:')) {
      switchStoryElement(output, utterance.slice(5))
    } else if (utterance === '<br>') {
      breakLine()
    } else {
      appendStoryElement(utterance)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    // utterances end with a line break, and may be split across chunks
    const text = unfinished + decoder.decode(value, { stream: true })
    const utterances = text.split('\n')
    unfinished = utterances.pop()
    utterances.forEach(hear)
    if (shouldFollowStory()) {
      document.getElementById('end').scrollIntoView()
    }
    if (isSnapshot) {
      setTimeout(() => {
        isSnapshot = false
        document.getElementById('end').scrollIntoView()
      }, 100)
    }
  }
}

document.getElementById('play').addEventListener('click', () => listen())
