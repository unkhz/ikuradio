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
  // a body without its music clips still sings, unaccompanied
  const files = await readdir(`audio/${cat}`).catch(() => [] as string[])
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
      lines: [...lines.values()]
        .filter(({ file }) => file)
        .map(({ file, at }) => ({ file, at })),
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
        // what is being sung, and the weather it grows in, for everyone here
        // now and for anyone who walks in from now on
        const about = shown
          ? `about:${JSON.stringify({
              iteration: `${event.content}`,
              mood: shown.mood.descriptions,
              mode: shown.mood.character.mode,
              tempo: shown.mood.character.tempo,
              choir: introduce(shown.choir),
              variation: shown.variation,
            })}`
          : undefined
        const weather = shown
          ? `weather:${shown.mood.descriptions.join(' + ')}`
          : undefined
        const prelude = [about, weather].filter((u) => u !== undefined)
        room.turnPage(prelude)
        // this moment is the iteration's beginning; listeners keep time from here
        say(`begin:${current}`)
        if (about) say(about)
        if (weather && (shown?.beginsSong || justWoke)) {
          // a new Song, or the song has just woken: everyone here is shown the weather
          say(weather)
        }
        room.turnPage(prelude)
        justWoke = false
        console.log(
          `Iteration ${event.content}, ${shown ? `${describe(shown.mood)}, sung by ${introduce(shown.choir)}` : '?'}, ${category.key}`,
        )
        break
      }
      case 'stumble': {
        console.warn(
          `The song stumbled, and will try again in a moment: ${event.content}`,
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
        say(`part:${event.content}`)
        break
      }
      case 'line': {
        const sung = sungLine(event)
        if (sung?.file) {
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

/**
 * Reads back through the diary for anyone who asks: the iterations already
 * sung, newest first. Neither the one being sung now nor the one written
 * ahead is shown before its time. Iterations are counted from one, the way
 * the chorus counts them.
 */
async function lookBack({ before, count }: { before?: bigint; count: number }) {
  const asked = before === undefined ? current : before - 1n
  const until = asked < current ? asked : current
  const pages = await diary.recent({ count, before: until })
  return pages.map((page) => ({
    iteration: `${BigInt(page.iteration) + 1n}`,
    mood: page.mood.descriptions,
    mode: page.mood.character.mode,
    tempo: page.mood.character.tempo,
    choir: page.choir ? introduce(page.choir) : undefined,
    written: page.written,
    parts: arrange(page.lyrics).map(({ type, content }) => ({ type, content })),
  }))
}

createServer(room, lookBack).listen(SERVER_PORT, () => {
  console.log(`The song can be heard at http://127.0.0.1:${SERVER_PORT}/`)
})

run()
