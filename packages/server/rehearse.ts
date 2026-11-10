// A rehearsal: the song sung from its very beginning, each iteration start
// to finish into a single take, without the server, the browser, or an
// audience, and without touching the server's diary.
//
//   bun run rehearse          iteration zero, the words a human wrote
//   bun run rehearse 5        iterations zero to five, each grown from
//                             the one before, past the first change of Mood
//
// Every iteration grows from the previous one, so there is no skipping
// ahead: to hear the fifth, the song has to live through the first four.
//
// Takes are written to audio/rehearsal/<iteration>.m4a, with their
// words beside them, and the rehearsal's own diary in audio/rehearsal/.
//
// When every iteration is sung, the mind rests and the Music wakes: each
// iteration's parts are accompanied, and the beds are written beside the
// voice as <iteration>.music.m4a, and under it as <iteration>.together.m4a.
// The two cannot be awake at once; the machine has one GPU.
//
//   bun run rehearse 5 --dry  the voices alone, no Music

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { arrange } from 'song'
import { describe } from 'mood'
import { introduce, mixdown } from 'vocals'
import { Shelf, underlay } from 'music'
import { getEnv, wakeMind } from 'tools'
import { Diary } from './lib/diary.js'
import { composer } from './lib/compose.js'
import { perform } from './lib/perform.js'

const { ITERATION_COUNT, MOOD_COUNT, CHOIR_COUNT, VARIATION_COUNT } = getEnv()
const given = process.argv.slice(2)
const last = BigInt(given.find((arg) => /^\d+$/.test(arg)) ?? 0)
const dry = given.includes('--dry')
const dir = 'audio/rehearsal'

await mkdir(dir, { recursive: true })
await rm(`${dir}/diary.jsonl`, { force: true })
const { compose } = await composer(new Diary(`${dir}/diary.jsonl`), {
  songLength: ITERATION_COUNT,
  moodCount: MOOD_COUNT,
  choirSize: CHOIR_COUNT,
  variationCount: VARIATION_COUNT,
})

const seconds = (ms: number) => (ms / 1000).toFixed(1)

// only iterations after the first need new words, and a mind to write them
const mind = last > 0n ? wakeMind(`${dir}/mind.log`) : undefined
if (mind && !(await mind.ready)) {
  console.warn('the mind did not wake; the rehearsal waits for it as the song would')
}

const sung: {
  take: string
  lines: Awaited<ReturnType<typeof perform>>
  mood: Awaited<ReturnType<typeof compose>>['mood']
  iteration: bigint
}[] = []

for (let iteration = 0n; iteration <= last; iteration++) {
  const started = Date.now()
  const composed = await compose(iteration)
  const written = Date.now()
  const lines = await perform(composed)
  if (composed.beginsSong) {
    console.log(`\n~ ${describe(composed.mood)} ~`)
    console.log(`  sung by ${introduce(composed.choir)}`)
  }
  console.log(`\niteration ${iteration}, variation ${composed.variation}\n`)
  for (const { at, part, lyrics } of lines) {
    console.log(`${at.toFixed(1).padStart(6)}s  ${part.padEnd(6)} ${lyrics}`)
  }
  const take = `${dir}/${iteration}`
  await mixdown(
    lines.filter(({ file }) => file),
    `${take}.m4a`,
  )
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
  sung.push({ take, lines, mood: composed.mood, iteration })
}

// the words are written; the mind lets go of the GPU, and the Music may have it
await mind?.rest()

if (!dry) {
  // the shelf the live song keeps: a part grows a new bed, or plays one again
  const shelf = new Shelf()
  for (const { take, lines, mood, iteration } of sung) {
    const started = Date.now()
    try {
      const { beds } = await underlay(lines, mood, { shelf, iteration })
      if (beds.length === 0) continue
      await mixdown(beds, `${take}.music.m4a`)
      await mixdown(
        [...lines.filter(({ file }) => file), ...beds],
        `${take}.together.m4a`,
      )
      console.log(
        `${take}.together.m4a: ${new Set(beds.map(({ file }) => file)).size} beds` +
          ` under ${beds.length} sections, grown in ${seconds(Date.now() - started)}s`,
      )
    } catch (error) {
      console.warn(`${take}: the Music did not come: ${(error as Error).message}`)
    }
  }
}
