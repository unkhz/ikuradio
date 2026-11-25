// CLI for the Studio's manual production queue (`memory/queue.jsonl`).
//
// Usage:
//   bun run queue                       List queued Songs
//   bun run queue list                  List queued Songs
//   bun run queue add [options]         Validate and enqueue a Song request
//   bun run queue pop                   Remove the next Song from the queue
//   bun run queue remove <id>           Remove a queued Song by id (or prefix)
//   bun run queue clear                 Remove all queued Songs
//
// Options for `add`:
//   -a, --arrangement <id>              Active makeable Arrangement (e.g. the-ascent, tempo-turns)
//   -t, --tempo <bpm>                   Mood tempo in bpm (20-300)
//   -m, --mode <mode>                   Musical mode (ionian, dorian, phrygian, lydian, mixolydian, aeolian, harmonic)
//       --mood <phrases>                Weather descriptions (repeatable, or comma-separated)
//   -s, --sound <text>                  MusicGen band sound description
//   -p, --perspectives <slugs|none>     Comma-separated Perspective slugs, or "none" for zero perspectives
//   -c, --choir <1-4>                   Number of voices in the choir
//       --lead <male|female|child>      Lead voice body
//       --breath <soft|plain|pressed>   Choir breath preset
//       --rate <2-12>                   Max syllables per second
//   -n, --note <text>                   Label/reason logged by Studio
//       --count <1-10>                  Enqueue N copies of this request (default 1)
//       --json <object>                 Raw JSON spec (merged with any flags)
//       --file <path>                   Queue file path (default memory/queue.jsonl)

import type { Breath, ModeName, Singer } from 'melody'
import { describeQueued, SongQueue, validateQueuedSong, type QueuedSongSpec } from './lib/queue.js'

const help = () => {
  console.log(
    [
      'Usage:',
      '  queue [list]                        Show queued Songs (FIFO)',
      '  queue add [options]                 Validate and enqueue a Song',
      '  queue pop                           Remove the first queued Song',
      '  queue remove <id>                   Remove a queued Song by id or prefix',
      '  queue clear                         Empty the queue',
      '',
      'Options for add:',
      '  -a, --arrangement <id>              Active makeable Arrangement (e.g. the-ascent, tempo-turns)',
      '  -t, --tempo <bpm>                   Mood tempo (20-300)',
      '  -m, --mode <mode>                   Mode (ionian, dorian, phrygian, lydian, mixolydian, aeolian, harmonic)',
      '      --mood <phrases>                Mood descriptions (repeatable or comma-separated)',
      '  -s, --sound <text>                  MusicGen sound description',
      '  -p, --perspectives <slugs|none>     Perspective slugs (comma-separated) or "none"',
      '  -c, --choir <1-4>                   Choir voice count',
      '      --lead <male|female|child>      Lead singer body',
      '      --breath <soft|plain|pressed>   Choir breath preset',
      '      --rate <2-12>                   Syllables per second limit',
      '  -n, --note <text>                   Note logged when Studio builds the Song',
      '      --count <1-10>                  Enqueue N copies (default 1)',
      '      --json <object>                 JSON spec merged with flags',
    ].join('\n'),
  )
}

export async function runQueueCli(argv: readonly string[]): Promise<number> {
  const args = [...argv]
  let file = 'memory/queue.jsonl'
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file') {
      const next = args[i + 1]
      if (!next) {
        console.error('--file requires a path')
        return 2
      }
      file = next
      args.splice(i, 2)
      i--
    }
  }

  const queue = new SongQueue(file)
  const cmd = args[0] ?? 'list'

  if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
    help()
    return 0
  }

  if (cmd === 'list' || cmd === 'ls') {
    const entries = await queue.list()
    if (entries.length === 0) {
      console.log('Queue is empty (Studio will draw Songs autonomously).')
      return 0
    }
    console.log(`Queued Songs (${entries.length}, FIFO):`)
    for (const [i, entry] of entries.entries()) {
      console.log(`  ${i + 1}. [${entry.id}] ${describeQueued(entry)}  (queued ${entry.queued})`)
    }
    return 0
  }

  if (cmd === 'pop') {
    const removed = await queue.pop()
    if (!removed) {
      console.log('Queue is already empty.')
      return 0
    }
    console.log(`Popped [${removed.id}] ${describeQueued(removed)}`)
    return 0
  }

  if (cmd === 'remove' || cmd === 'rm') {
    const target = args[1]
    if (!target) {
      console.error('remove requires an entry id (or prefix)')
      return 2
    }
    const entries = await queue.list()
    const matches = entries.filter((e) => e.id === target || e.id.startsWith(target))
    if (matches.length === 0) {
      console.error(`No queued Song matches "${target}".`)
      return 1
    }
    if (matches.length > 1) {
      console.error(`Ambiguous prefix "${target}" matches: ${matches.map((m) => m.id).join(', ')}`)
      return 1
    }
    const [one] = matches
    const removed = await queue.consume(one!.id)
    if (!removed) {
      console.error(`Queued Song "${one!.id}" was already consumed.`)
      return 1
    }
    console.log(`Removed [${one!.id}] ${describeQueued(one!)}`)
    return 0
  }

  if (cmd === 'clear') {
    const removed = await queue.clear()
    console.log(removed ? `Cleared ${removed} queued Song${removed === 1 ? '' : 's'}.` : 'Queue is already empty.')
    return 0
  }

  if (cmd === 'add') {
    const spec: QueuedSongSpec = {}
    let count = 1
    const moods: string[] = []
    let sawMood = false
    const rest = args.slice(1)
    const need = (i: number, flag: string) => {
      const value = rest[i + 1]
      if (value === undefined) throw new Error(`${flag} requires a value`)
      return value
    }
    try {
      for (let i = 0; i < rest.length; i++) {
        const flag = rest[i]!
        switch (flag) {
          case '--json': {
            const raw = JSON.parse(need(i, flag))
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('--json must be a JSON object')
            Object.assign(spec, raw)
            i++
            break
          }
          case '-a':
          case '--arrangement':
            spec.arrangement = need(i, flag)
            i++
            break
          case '-t':
          case '--tempo':
            spec.tempo = Number(need(i, flag))
            i++
            break
          case '-m':
          case '--mode':
            spec.mode = need(i, flag) as ModeName
            i++
            break
          case '--mood': {
            sawMood = true
            const raw = need(i, flag)
            for (const part of raw.split(',')) {
              const trimmed = part.trim()
              if (trimmed) moods.push(trimmed)
            }
            i++
            break
          }
          case '-s':
          case '--sound':
            spec.sound = need(i, flag)
            i++
            break
          case '-p':
          case '--perspectives': {
            const raw = need(i, flag).trim()
            spec.perspectives = !raw || raw.toLowerCase() === 'none' ? [] : raw.split(',').map((s) => s.trim()).filter(Boolean)
            i++
            break
          }
          case '-c':
          case '--choir':
            spec.choir = Number(need(i, flag))
            i++
            break
          case '--lead':
            spec.lead = need(i, flag) as Singer
            i++
            break
          case '--breath':
            spec.breath = need(i, flag) as Breath
            i++
            break
          case '--rate':
            spec.rate = Number(need(i, flag))
            i++
            break
          case '-n':
          case '--note':
            spec.note = need(i, flag)
            i++
            break
          case '--count': {
            count = Number(need(i, flag))
            if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error('--count must be an integer between 1 and 10')
            i++
            break
          }
          default:
            throw new Error(`Unknown option: ${flag}`)
        }
      }
      if (sawMood) spec.mood = moods
    } catch (error) {
      console.error((error as Error).message)
      return 2
    }

    const problem = await validateQueuedSong(spec)
    if (problem) {
      console.error(`Refused: ${problem}`)
      return 1
    }

    for (let k = 0; k < count; k++) {
      const added = await queue.push(spec)
      console.log(`Queued [${added.id}] ${describeQueued(added)}`)
    }
    return 0
  }

  console.error(`Unknown command: ${cmd} (try: list, add, pop, remove, clear)`)
  return 2
}

if (import.meta.main) {
  process.exit(await runQueueCli(process.argv.slice(2)))
}
