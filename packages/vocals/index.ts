export {
  countSyllables,
  record,
  prepareLyrics,
  recordingName,
  throatScore,
  vocalsDir,
  makeOnce,
} from './lib/chimera.js'
export { throatFingerprint, throatName } from './lib/throat.js'
export { play } from './lib/play.js'
export { readAloud } from './lib/reading.js'
export { mixdown, blend, fullness, type Placed } from './lib/mixdown.js'
export { humanize, keepsPace, quickest, TooFast, wrongness, type Take, type Throat } from './lib/humanize.js'
export {
  gather,
  introduce,
  firstChoir,
  throatOf,
  type Choir,
  type Voice,
} from './lib/singers.js'
export { run, Turns } from './lib/exec.js'
export { loudnessOf, parseLoudness, silence, type Loudness } from './lib/loudness.js'
export { encodeWav, speakInto, speechRate, type SpeechSegment, type SpeechSpec } from './lib/speak.js'
export { renderDrone, renderDrums, renderPulse, renderSynth, synthInto, synthRate, type SynthSpec } from './lib/synth.js'
export { composeScat, isIpaScatToken, parseIpaSyllable, parseIpaToken, type ParsedIpaToken } from './lib/scat.js'
