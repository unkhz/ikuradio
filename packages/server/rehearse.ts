// A rehearsal: one iteration, sung start to finish into a single take,
// without the server, the browser, or an audience.
//
//   task server:rehearse                 iteration zero, the original words
//   task server:rehearse -- 412          a later iteration (asks for new words)
//
// The take is written to audio/rehearsal/<iteration>-<singer>.m4a

import { mkdir } from 'node:fs/promises'
import song from 'song'
import { scoreSeconds, setLine } from 'melody'
import { countSyllables, mixdown, record, type Placed } from 'vocals'
import { getEnv } from 'tools'

const { SINGER } = getEnv()
const iteration = BigInt(process.argv[2] ?? 0)

const parts = await song(iteration)
const placed: Placed[] = []
let at = 0
for (const { type: part, content } of parts) {
  for (const [index, lyrics] of content.split('\n').entries()) {
    if (!lyrics.trim()) continue
    const syllables = await countSyllables(lyrics)
    const score = setLine({
      part,
      line: index,
      lyrics,
      syllables,
      singer: SINGER,
    })
    placed.push({ file: await record(score, SINGER), at })
    console.log(`${at.toFixed(1).padStart(6)}s  ${part.padEnd(6)} ${lyrics}`)
    at += scoreSeconds(score)
  }
}

await mkdir('audio/rehearsal', { recursive: true })
const take = `audio/rehearsal/${iteration}-${SINGER}.m4a`
await mixdown(placed, take)
console.log(`\n${take}, ${at.toFixed(1)} seconds`)
