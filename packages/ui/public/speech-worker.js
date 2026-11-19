// The speaking throat, away from the page's own thread, so the page never
// stutters while a DJ's words are said. The page sends the compiled engine and
// the dictionary once, then asks for speech; each comes back as samples.

import { openSpeech } from './speech.js'

let speech

onmessage = async ({ data }) => {
  if (data.open) {
    try {
      speech = await openSpeech(data.open.engine, data.open.dictionary)
      postMessage({ opened: true })
    } catch (error) {
      postMessage({ opened: false, error: String(error) })
    }
    return
  }
  try {
    const said = speech.say(data.say)
    postMessage({ job: data.job, ...said }, [said.samples.buffer])
  } catch (error) {
    postMessage({ job: data.job, error: String(error) })
  }
}
