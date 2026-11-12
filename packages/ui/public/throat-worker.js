// One singer's throat, away from the page's own thread, so the page never
// stutters while a take is sung. The page sends the compiled engine and the
// dictionary once, then takes one at a time; each comes back as samples.

import { openThroat } from './throat.js'

let throat

onmessage = async ({ data }) => {
  if (data.open) {
    try {
      throat = await openThroat(data.open.engine, data.open.dictionary)
      postMessage({ opened: true })
    } catch (error) {
      postMessage({ opened: false, error: String(error) })
    }
    return
  }
  const { job, take, body } = data
  try {
    const samples = throat.sing(take, body)
    postMessage({ job, samples }, [samples.buffer])
  } catch (error) {
    postMessage({ job, error: String(error) })
  }
}
