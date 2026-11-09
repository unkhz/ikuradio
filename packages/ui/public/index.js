function createAudioElement(file, volume) {
  const audioEl = document.createElement('audio')
  audioEl.src = `http://127.0.0.1:3000/${file}`
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
  targetGainValue
) {
  newTrack.gain.gain.setValueAtTime(0, audioContext.currentTime)

  // When the startCrossfade starts, reduce the volume of source 1 to 0 and increase the volume of source 2 to 1
  oldTrack.gain.gain.linearRampToValueAtTime(
    0,
    audioContext.currentTime + durationSeconds
  )
  newTrack.gain.gain.linearRampToValueAtTime(
    targetGainValue,
    audioContext.currentTime + durationSeconds
  )
}

function playVoice(audioContext, audioSrc) {
  const audioEl = createAudioElement(audioSrc, 1)
  const track = createTrack(audioContext, audioEl, 1)
  const delay = createDelay(audioContext, 0.5, 0.22)
  track.out.connect(delay.in)
  delay.out.connect(audioContext.destination)

  audioEl.addEventListener('ended', () => {
    audioEl.remove()
  })
  audioEl.play()
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

let el
switchStoryElement = (parent) => {
  el = document.createElement('p')
  parent.appendChild(el)
}
appendStoryElement = (text) => {
  el.innerHTML += text
}

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

async function read() {
  document.getElementById('controls').style.display = 'none'
  const output = document.getElementById('output')
  const response = await fetch(`http://127.0.0.1:3000`)
  if (response.body) {
    const reader = response.body.getReader()
    let i = 0
    let hist = []
    let isSnapshot = true
    switchStoryElement(output)
    const audioContext = new AudioContext()

    while (true) {
      const { done, value: chunk } = await reader.read()
      const chars = new TextDecoder().decode(chunk).slice(0, -1)
      for (const char of chars.split('\n')) {
        hist = `${hist}${char}`.slice(-8)
        if (char.startsWith('play:')) {
          if (!isSnapshot) {
            const audioSrc = char.slice(5)
            const isVoice = audioSrc.startsWith('audio/vocals')
            if (isVoice) {
              playVoice(audioContext, audioSrc)
            } else {
              playMusic(audioContext, audioSrc)
            }
          }
        } else {
          if (hist.endsWith('<br><br>')) {
            switchStoryElement(output)
          } else {
            appendStoryElement(char)
          }
        }
        if (shouldFollowStory()) {
          document.getElementById('end').scrollIntoView()
        }
        i = (i + 1) % 1024
      }
      if (done) break
      if (isSnapshot) {
        setTimeout(() => {
          isSnapshot = false
          document.getElementById('end').scrollIntoView()
        }, 100)
      }
    }
  }
}

document.getElementById('play').addEventListener('click', () => read())
