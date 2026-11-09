// A rehearsal: the song sung from its beginning, each iteration start to
// finish into a single take, without the server, the browser, or an audience.
//
//   task server:rehearse          iteration zero, the words a human wrote
//   task server:rehearse -- 3     iterations zero to three, each grown from
//                                 the one before by the mind
//
// Every iteration grows from the previous one, so there is no skipping
// ahead: to hear the third, the song has to live through the first two.
//
// Takes are written to audio/rehearsal/<iteration>-<singer>.m4a

import { mkdir, writeFile } from 'node:fs/promises'
import song from 'song'
import { scoreSeconds, setLine } from 'melody'
import { countSyllables, mixdown, record, type Placed } from 'vocals'
import { getEnv } from 'tools'

const { SINGER } = getEnv()
const last = BigInt(process.argv[2] ?? 0)

await mkdir('audio/rehearsal', { recursive: true })

for (let iteration = 0n; iteration <= last; iteration++) {
  const started = Date.now()
  const parts = await song(iteration)
  const written = Date.now()
  const placed: Placed[] = []
  const words: string[] = []
  let at = 0
  console.log(`\niteration ${iteration}\n`)
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
    words.push(content, '')
  }
  const take = `audio/rehearsal/${iteration}-${SINGER}`
  await mixdown(placed, `${take}.m4a`)
  await writeFile(`${take}.txt`, words.join('\n'))
  const seconds = (ms: number) => (ms / 1000).toFixed(1)
  console.log(
    `\n${take}.m4a: ${at.toFixed(1)}s of song,` +
      ` written in ${seconds(written - started)}s,` +
      ` sung in ${seconds(Date.now() - written)}s`,
  )
}
