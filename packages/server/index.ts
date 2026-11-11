import { getEnv, Sleeper } from 'tools'
import { arrange, words } from 'song'
import { describe } from 'mood'
import { introduce, vocalsDir, type Placed } from 'vocals'
import { musicDir, Shelf, underlay } from 'music'
import { sweep } from './lib/sweep.js'
import { sing, type LineEvent, type TimedPart } from './lib/sing.js'
import { createServer } from './lib/server.js'
import { Diary } from './lib/diary.js'
import { composer, type Iteration } from './lib/compose.js'
import { lineKey, perform, type SungLine } from './lib/perform.js'
import { Room } from './lib/room.js'
import { Heart } from './lib/heart.js'
import { rm } from 'node:fs/promises'

const {
  SERVER_PORT,
  ITERATION_COUNT,
  MOOD_COUNT,
  CHOIR_COUNT,
  VARIATION_COUNT,
} = getEnv()

// recordings left behind by a song that was stopped are let go before it sings again
const swept = await sweep([vocalsDir, musicDir])
if (swept) console.log(`Swept up ${swept} recordings left behind when the song last stopped.`)

const room = new Room()
// the mind and the Music share one GPU: the mind wakes for the words of an
// iteration and rests while the Music grows its beds
const mind = new Sleeper()
const shelf = new Shelf()
/**
 * Whether the Music is with the song. When it cannot come, the song sings
 * unaccompanied until the next Song begins, and then asks for it again: a
 * GPU that was busy may be free, a model that was missing may have arrived.
 */
let alone = false
/** Whether the Music is asked for in this iteration. */
const asksForMusic = (composed: Iteration) => !alone || composed.beginsSong
const heart = new Heart()

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
  { iteration: Iteration; lines: Map<string, SungLine>; beds: Placed[] }
>()

/** Beds that left the shelf, let go once no iteration still plays them. */
const leaving = new Set<string>()

async function forgetBeds() {
  const playing = new Set(
    [...performed.values()].flatMap(({ beds }) => beds.map(({ file }) => file)),
  )
  const kept = new Set(shelf.all)
  for (const file of leaving) {
    if (playing.has(file) || kept.has(file)) continue
    leaving.delete(file)
    await rm(file, { force: true })
  }
}

/**
 * The beds under an iteration. If the Music cannot come, the song says so,
 * and sings unaccompanied until the next Song, when it asks again. While it
 * is alone, its mind no longer rests between iterations, since nobody else
 * needs the GPU.
 */
async function accompany(composed: Iteration, lines: SungLine[]) {
  if (!asksForMusic(composed)) return []
  try {
    const { beds, departed, grown } = await underlay(lines, composed.mood, {
      shelf,
      iteration: composed.iteration,
    })
    for (const file of departed) leaving.add(file)
    if (alone) console.log('The Music has come back to the song.')
    alone = false
    heart.accompanied(grown)
    return beds
  } catch (error) {
    const because = (error as Error).message.split('\n').at(-1) ?? 'unknown'
    if (!alone) {
      console.warn(
        `The Music did not come; the song sings unaccompanied until the next Song: ${(error as Error).message}`,
      )
    }
    alone = true
    heart.alone(because)
    return []
  }
}

/** The iteration being shown right now. */
let current = wakesAt

/**
 * Each iteration is composed, set to its tunes and sung through before it
 * is shown, so that a line is never typed before its voice exists.
 */
async function getSungSong(iteration: bigint): Promise<TimedPart[]> {
  await mind.wake()
  const composed = await compose(iteration)
  // the words are written; the mind rests while the voices are sung, and the Music has the GPU
  const resting = asksForMusic(composed) ? mind.rest() : Promise.resolve()
  const sung = await perform(composed)
  await resting
  const beds = await accompany(composed, sung)
  const lines = new Map(sung.map((l) => [lineKey(l.part, l.index, l.lyrics), l]))
  performed.set(iteration, { iteration: composed, lines, beds })
  await forgetBeds()
  // the score, so that listeners can prepare every voice before it is due
  room.announce(
    `score:${JSON.stringify({
      iteration: `${iteration}`,
      lines: [...lines.values()]
        .filter(({ file, unheard }) => file && !unheard)
        .map(({ file, at }) => ({ file, at })),
      beds,
    })}`,
  )
  return arrange(composed.lyrics).map((part) => ({
    ...part,
    timing: part.content.split('\n').map((line, index) => {
      const sung = lines.get(
        part.type === 'bridge'
          ? lineKey('bridge', part.index, '')
          : lineKey(part.type, index, line),
      )
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
  await forgetBeds()
}

const sungLine = ({ part, index, content, section }: LineEvent) =>
  performed
    .get(current)
    ?.lines.get(
      part === 'bridge'
        ? lineKey('bridge', section, '')
        : lineKey(part, index, content),
    )

async function run() {
  const say = (chunk: string) => room.say(chunk)

  /** True until the first iteration after waking has begun. */
  let justWoke = true

  for await (const event of sing(getSungSong, wakesAt)) {
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
        // what is being sung, and the weather it grows in, for everyone here
        // now and for anyone who walks in from now on
        const about = shown
          ? `about:${JSON.stringify({
              iteration: `${event.content}`,
              mood: shown.mood.descriptions,
              mode: shown.mood.character.mode,
              tempo: shown.mood.character.tempo,
              sound: shown.mood.character.sound,
              choir: introduce(shown.choir),
              variation: shown.variation,
              // where in its Song this iteration is, counted from one, as the chorus counts
              song: {
                number: `${BigInt(shown.song.number) + 1n}`,
                at: Number(shown.iteration - BigInt(shown.song.began)) + 1,
                of: shown.song.lasts,
              },
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
        if (shown) {
          const lines = [...(performed.get(current)?.lines.values() ?? [])]
          heart.beat({
            iteration: event.content,
            seconds: Math.max(0, ...lines.map((l) => l.at + l.seconds)),
            mood: shown.mood.descriptions.join(' + '),
          })
        }
        justWoke = false
        console.log(
          `Iteration ${event.content}, ${shown ? `${describe(shown.mood)}, sung by ${introduce(shown.choir)}` : '?'}`,
        )
        break
      }
      case 'stumble': {
        heart.stumble()
        console.warn(
          `The song stumbled, and will try again in a moment: ${event.content}`,
        )
        break
      }
      case 'fermata': {
        heart.fermata()
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
        if (sung?.file && !sung.unheard) {
          say(`play:${sung.file}`)
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
    parts: words(page.lyrics).map(({ type, content }) => ({ type, content })),
  }))
}

const door = createServer(room, {
  lookBack,
  pulse: () => heart.pulse(room.size),
})

/**
 * When the machine asks the song to stop, it does not simply fall silent.
 * It tells everyone listening that it is resting, shows them out, closes
 * its door, and stops. Its diary already says where it was; when it is
 * woken again it will carry on from there.
 */
let resting = false
function rest(signal: string) {
  if (resting) return
  resting = true
  console.log(`The song rests (${signal}). It will wake where its diary says.`)
  room.say('rest:the song is resting')
  room.close()
  door.close()
  mind.rest()
  // a moment for the last words to reach whoever was listening
  setTimeout(() => process.exit(0), 300)
}
process.on('SIGTERM', () => rest('SIGTERM'))
process.on('SIGINT', () => rest('SIGINT'))

door.listen(SERVER_PORT, () => {
  console.log(`The song can be heard at http://127.0.0.1:${SERVER_PORT}/`)
})

run()
