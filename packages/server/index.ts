import { getEnv } from 'tools'
import { arrange } from 'song'
import { describe } from 'mood'
import { introduce } from 'vocals'
import { sing, type LineEvent, type TimedPart } from './lib/sing.js'
import { createServer } from './lib/server.js'
import { Diary } from './lib/diary.js'
import { composer, type Iteration } from './lib/compose.js'
import { lineKey, perform, type SungLine } from './lib/perform.js'
import { Room } from './lib/room.js'
import { readdir, rm } from 'node:fs/promises'

const {
  SERVER_PORT,
  ITERATION_COUNT,
  MOOD_COUNT,
  CHOIR_COUNT,
  VARIATION_COUNT,
} = getEnv()

async function readRandomMusicFile(cat: string) {
  const files = await readdir(`audio/${cat}`)
  const musicFiles = files.filter((file) => file.endsWith('.mp3'))
  const picked = musicFiles[Math.floor(Math.random() * musicFiles.length)]
  if (picked) {
    return `audio/${cat}/${picked}`
  }
}

const room = new Room()

const diary = new Diary('memory/diary.jsonl')
const { wakesAt, compose } = await composer(diary, {
  songLength: ITERATION_COUNT,
  moodCount: MOOD_COUNT,
  choirSize: CHOIR_COUNT,
  variationCount: VARIATION_COUNT,
})

/** The iterations that are written and sung, waiting to be shown, or being shown. */
const performed = new Map<
  bigint,
  { iteration: Iteration; lines: Map<string, SungLine> }
>()

/** The iteration being shown right now. */
let current = wakesAt

/**
 * Each iteration is composed, set to its tunes and sung through before it
 * is shown, so that a line is never typed before its voice exists.
 */
async function getSungSong(iteration: bigint): Promise<TimedPart[]> {
  const composed = await compose(iteration)
  const lines = new Map(
    (await perform(composed)).map((l) => [
      lineKey(l.part, l.index, l.lyrics),
      l,
    ]),
  )
  performed.set(iteration, { iteration: composed, lines })
  // the score, so that listeners can prepare every voice before it is due
  room.announce(
    `score:${JSON.stringify({
      iteration: `${iteration}`,
      lines: [...lines.values()].map(({ file, at }) => ({ file, at })),
    })}`,
  )
  return arrange(composed.lyrics).map((part) => ({
    ...part,
    timing: part.content.split('\n').map((line, index) => {
      const sung = lines.get(lineKey(part.type, index, line))
      return sung ?? { seconds: 0, enters: 0, voiced: 0 }
    }),
  }))
}

/**
 * Lets go of an iteration once it has been shown. Its recordings are
 * deleted, unless an iteration still waiting to be shown sings them too.
 * The diary remembers the words; the voices are let go.
 */
async function letGo(iteration: bigint) {
  const gone = performed.get(iteration)
  if (!gone) return
  performed.delete(iteration)
  const kept = new Set(
    [...performed.values()].flatMap(({ lines }) =>
      [...lines.values()].flatMap((line) => line.recordings),
    ),
  )
  const recordings = new Set(
    [...gone.lines.values()].flatMap((line) => line.recordings),
  )
  for (const file of recordings) {
    if (!kept.has(file)) await rm(file, { force: true })
  }
}

const sungLine = ({ part, index, content }: LineEvent) =>
  performed.get(current)?.lines.get(lineKey(part, index, content))

type CategoryConfig = {
  key: string
  duration: number
}
const categories: Record<CategoryConfig['key'], CategoryConfig> = {
  'violin-music': {
    key: 'violin-music',
    duration: 25_000,
  },
  'violin-music-chorus': {
    key: 'violin-music-chorus',
    duration: 45_000,
  },
}

function pickCategory() {
  const keys = Object.keys(categories)
  const pickedKey = keys[Math.floor(Math.random() * keys.length)]
  return categories[pickedKey]
}

async function run() {
  const say = (chunk: string) => room.say(chunk)

  /** True until the first iteration after waking has begun. */
  let justWoke = true
  let lastMusicTime = 0
  let category = pickCategory()

  for await (const event of sing(getSungSong, wakesAt)) {
    const now = Date.now()
    switch (event.type) {
      case 'iteration': {
        // the event counts from one; the iteration being shown is the one before
        const next = event.content - 1n
        if (next !== current) {
          // a listener may still be hearing the last line; let it finish first
          const shown = current
          setTimeout(() => letGo(shown), 60_000)
        }
        current = next
        const shown = performed.get(current)?.iteration
        category = pickCategory()
        // the weather this Song grows in, for anyone who walks in from now on
        const weather = shown
          ? [`~ ${shown.mood.descriptions.join(' + ')} ~`, '<br>', '<br>']
          : []
        room.turnPage(weather)
        // this moment is the iteration's beginning; listeners keep time from here
        say(`begin:${current}`)
        if (shown?.beginsSong || justWoke) {
          // a new Song, or the song has just woken: everyone already here is
          // shown the weather too
          weather.forEach(say)
          room.turnPage(weather)
        }
        justWoke = false
        console.log(
          `Iteration ${event.content}, ${shown ? `${describe(shown.mood)}, sung by ${introduce(shown.choir)}` : '?'}, ${category.key}`,
        )
        break
      }
      case 'fermata': {
        console.log(
          `Fermata: the song held its breath ${event.content.toFixed(1)}s for the next iteration`,
        )
        break
      }
      case 'part': {
        // TODO
        break
      }
      case 'line': {
        const sung = sungLine(event)
        if (sung) {
          say(`play:${sung.file}`)
        }
        if (now - lastMusicTime > category.duration) {
          lastMusicTime = now
          readRandomMusicFile(category.key).then(async (filename) => {
            if (filename) {
              say(`play:${filename}`)
            }
          })
        }
        break
      }
      case 'char': {
        say(event.content === '\n' ? '<br>' : event.content)
      }
    }
  }
}

createServer(room).listen(SERVER_PORT, () => {
  console.log(`Server running at http://127.0.0.1:${SERVER_PORT}/`)
})

run()
