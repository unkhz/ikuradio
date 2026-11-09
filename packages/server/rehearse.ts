// A rehearsal: the song sung from its very beginning, each iteration start
// to finish into a single take, without the server, the browser, or an
// audience, and without touching the server's diary.
//
//   task server:rehearse          iteration zero, the words a human wrote
//   task server:rehearse -- 5     iterations zero to five, each grown from
//                                 the one before, past the first change of Mood
//
// Every iteration grows from the previous one, so there is no skipping
// ahead: to hear the fifth, the song has to live through the first four.
//
// Takes are written to audio/rehearsal/<iteration>-<singer>.m4a, with their
// words beside them, and the rehearsal's own diary in audio/rehearsal/.

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { arrange } from 'song'
import { describe } from 'mood'
import { mixdown } from 'vocals'
import { getEnv } from 'tools'
import { Diary } from './lib/diary.js'
import { composer } from './lib/compose.js'
import { perform } from './lib/perform.js'

const { SINGER, ITERATION_COUNT, MOOD_COUNT } = getEnv()
const last = BigInt(process.argv[2] ?? 0)
const dir = 'audio/rehearsal'

await mkdir(dir, { recursive: true })
await rm(`${dir}/diary.jsonl`, { force: true })
const { compose } = await composer(new Diary(`${dir}/diary.jsonl`), {
  songLength: ITERATION_COUNT,
  moodCount: MOOD_COUNT,
})

const seconds = (ms: number) => (ms / 1000).toFixed(1)

for (let iteration = 0n; iteration <= last; iteration++) {
  const started = Date.now()
  const composed = await compose(iteration)
  const written = Date.now()
  const lines = await perform(composed, SINGER)
  if (composed.beginsSong) {
    console.log(`\n~ ${describe(composed.mood)} ~`)
  }
  console.log(`\niteration ${iteration}\n`)
  for (const { at, part, lyrics } of lines) {
    console.log(`${at.toFixed(1).padStart(6)}s  ${part.padEnd(6)} ${lyrics}`)
  }
  const take = `${dir}/${iteration}-${SINGER}`
  await mixdown(lines, `${take}.m4a`)
  await writeFile(
    `${take}.txt`,
    arrange(composed.lyrics)
      .map(({ content }) => content)
      .join('\n\n'),
  )
  const end = lines.at(-1)
  console.log(
    `\n${take}.m4a: ${seconds(((end?.at ?? 0) + (end?.seconds ?? 0)) * 1000)}s of song,` +
      ` written in ${seconds(written - started)}s,` +
      ` sung in ${seconds(Date.now() - written)}s`,
  )
}
