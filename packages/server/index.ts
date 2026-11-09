import { getEnv } from 'tools'
import { arrange } from 'song'
import { describe } from 'mood'
import { sing, type LineEvent } from './lib/sing.js'
import { createServer } from './lib/server.js'
import { Diary } from './lib/diary.js'
import { composer, type Iteration } from './lib/compose.js'
import { lineKey, perform, type SungLine } from './lib/perform.js'
import { createReadStream } from 'node:fs'
import { TextEncoderStream } from 'node:stream/web'
import { readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const { SERVER_PORT, SINGER, ITERATION_COUNT, MOOD_COUNT } = getEnv()

async function readRandomMusicFile(cat: string) {
  const files = await readdir(`audio/${cat}`)
  const musicFiles = files.filter((file) => file.endsWith('.mp3'))
  const picked = musicFiles[Math.floor(Math.random() * musicFiles.length)]
  if (picked) {
    return `audio/${cat}/${picked}`
  }
}

const stream = new TextEncoderStream()

const diary = new Diary('memory/diary.jsonl')
const { wakesAt, compose } = await composer(diary, {
  songLength: ITERATION_COUNT,
  moodCount: MOOD_COUNT,
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
async function getSungSong(iteration: bigint) {
  const composed = await compose(iteration)
  const lines = await perform(composed, SINGER)
  performed.set(iteration, {
    iteration: composed,
    lines: new Map(lines.map((l) => [lineKey(l.part, l.index, l.lyrics), l])),
  })
  return arrange(composed.lyrics)
}

const sungLine = ({ part, index, content }: LineEvent) =>
  performed.get(current)?.lines.get(lineKey(part, index, content))

/**
 * Types a line as fast as it is sung. The typing waits once for every
 * character, nine times more after a comma, and ten times more at the end.
 */
function pace(line: LineEvent) {
  const sung = sungLine(line)
  if (!sung) return 80
  const commas = line.content.split(',').length - 1
  const beats = line.content.length + commas * 9 + 10
  return (sung.seconds * 1000) / beats
}

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
  const writer = stream.writable.getWriter()
  const write = async (line: string) => {
    await writer.ready
    await writer.write(line + '\n')
  }

  let lastMusicTime = 0
  let category = pickCategory()

  for await (const event of sing(getSungSong, pace, wakesAt)) {
    const now = Date.now()
    switch (event.type) {
      case 'iteration': {
        // the event counts from one; the iteration being shown is the one before
        const next = event.content - 1n
        if (next !== current) performed.delete(current)
        current = next
        const shown = performed.get(current)?.iteration
        category = pickCategory()
        if (shown?.beginsSong) {
          // a new Song: show the weather it grows in
          await write(`~ ${shown.mood.descriptions.join(' + ')} ~`)
          await write('<br>')
          await write('<br>')
        }
        console.log(
          `Iteration ${event.content}, ${shown ? describe(shown.mood) : '?'}, ${category.key}`,
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
          write(`play:${sung.file}`)
        }
        if (now - lastMusicTime > category.duration) {
          lastMusicTime = now
          readRandomMusicFile(category.key).then(async (filename) => {
            if (filename) {
              await write(`play:${filename}` + '\n')
            }
          })
        }
        break
      }
      case 'char': {
        if (event.content === '\n') {
          writer.ready.then(() => writer.write('<br>' + '\n'))
        } else {
          writer.ready.then(() => writer.write(event.content + '\n'))
        }
      }
    }
  }
  await writer.ready
  writer.close()
}

let keeper = stream.readable
function forkStream() {
  const teed = keeper.tee()
  keeper = teed[0]
  return teed[1]
}

createServer(async (req, res) => {
  if (req.url?.includes('/audio/')) {
    const filename = req.url?.split('/').slice(-2).join('/')
    if ((await stat(`audio/${filename}`)).isFile()) {
      const eTag = createHash('sha1').update(filename).digest('hex')
      if (req.headers['if-none-match'] === eTag) {
        res.statusCode = 304
        res.end()
        return { stream: undefined }
      }
      return {
        stream: createReadStream(`audio/${filename}`),
        headers: {
          'Cache-Control': 'public, max-age=31536000',
          'Last-Modified': new Date().toUTCString(),
          ETag: createHash('sha1').update(filename).digest('hex'),
        },
      }
    }
  }
  return { stream: forkStream() }
}).listen(SERVER_PORT, () => {
  console.log(`Server running at http://127.0.0.1:${SERVER_PORT}/`)
})

run()
