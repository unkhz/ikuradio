import { getEnv } from 'tools'
import song from 'song'
import { setLine, scoreSeconds } from 'melody'
import { countSyllables, record } from 'vocals'
import { sing, type LineEvent } from './lib/sing.js'
import { createServer } from './lib/server.js'
import { createReadStream } from 'node:fs'
import { TextEncoderStream } from 'node:stream/web'
import { readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const { SERVER_PORT, SINGER } = getEnv()

async function readRandomMusicFile(cat: string) {
  const files = await readdir(`audio/${cat}`)
  const musicFiles = files.filter((file) => file.endsWith('.mp3'))
  const picked = musicFiles[Math.floor(Math.random() * musicFiles.length)]
  if (picked) {
    return `audio/${cat}/${picked}`
  }
}

const stream = new TextEncoderStream()

type SungLine = { file: string; seconds: number }

/** Every line already sung, by where it stands in the song and what it says. */
const sung = new Map<string, SungLine>()

const lineKey = ({ part, index, content }: Omit<LineEvent, 'type'>) =>
  `${part}:${index}:${content}`

/**
 * Each iteration is set to its tunes and sung through before it is shown, so
 * that a line is never typed before its voice exists.
 */
async function getSungSong(iteration: bigint) {
  const parts = await song(iteration)
  await Promise.all(
    parts.flatMap(({ type: part, content }) =>
      content.split('\n').map(async (line, index) => {
        if (!line.trim()) return
        const key = lineKey({ part, index, content: line })
        if (sung.has(key)) return
        const syllables = await countSyllables(line)
        const score = setLine({
          part,
          line: index,
          lyrics: line,
          syllables,
          singer: SINGER,
        })
        const file = await record(score, SINGER)
        sung.set(key, { file, seconds: scoreSeconds(score) })
      }),
    ),
  )
  return parts
}

/**
 * Types a line as fast as it is sung. The typing waits once for every
 * character, nine times more after a comma, and ten times more at the end.
 */
function pace(line: LineEvent) {
  const sungLine = sung.get(lineKey(line))
  if (!sungLine) return 80
  const commas = line.content.split(',').length - 1
  const beats = line.content.length + commas * 9 + 10
  return (sungLine.seconds * 1000) / beats
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

  for await (const event of sing(getSungSong, pace)) {
    const now = Date.now()
    switch (event.type) {
      case 'iteration': {
        category = pickCategory()
        console.log(`Iteration ${event.content}, ${category.key}`)
        break
      }
      case 'part': {
        // TODO
        break
      }
      case 'line': {
        const sungLine = sung.get(lineKey(event))
        if (sungLine) {
          write(`play:${sungLine.file}`)
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
