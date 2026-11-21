// What shapes a Song, as the pages of the Mood, the Perspectives and the Tides say it (plan "Evolution of Song", step 6):
// each read from the package that owns it, never copied: the Mood's character and weather, every Perspective with
// what it turns, the Settings they turn as a tree, and every Tide with its envelope as a curve.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { firstCharacter, modes } from 'melody'
import { fastest, firstMood, slowest, stride, weather } from 'mood'
import { clash, defaults, readPerspectives, resolve, type Settings } from 'perspectives'
import { parseRecord } from 'parts'
import { positionOf, readTides, validRange, valueAt, type TideRecord } from 'tides'

// ---- the Mood

/** What a Mood holds, the Mood the song was born in, the weather it draws from, the modes and the range of tempo. */
export function moodAnswer() {
  return {
    first: { descriptions: firstMood.descriptions, character: firstMood.character },
    // what a Mood is made of, and what each part of its character is
    holds: [
      { name: 'descriptions', says: 'a few words, blended, the oldest first: the weather the words are written in' },
      { name: 'character.mode', says: 'the mode the Tune is sung in' },
      { name: 'character.tempo', says: 'beats a minute' },
      { name: 'character.sound', says: 'how the band under the voice sounds, in a musician\'s words' },
      { name: 'character.voice', says: 'who leads the singing, and how the choir breathes' },
      { name: 'remembered', says: 'descriptions that left lately, which do not return until they are forgotten' },
    ],
    weather: [...weather],
    modes: Object.entries(modes).map(([name, degrees]) => ({ name, degrees: [...degrees] })),
    born: firstCharacter,
    tempo: { slowest, fastest, stride },
  }
}

// ---- the Perspectives, and the Settings they turn

type Change = { path: string[]; before: unknown; after: unknown }
const isNode = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Where two Settings differ, leaf by leaf. */
function differences(before: unknown, after: unknown, path: string[] = []): Change[] {
  if (isNode(before) && isNode(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) => differences(before[key], after[key], [...path, key]))
  }
  return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ path, before, after }]
}

/** A Perspective as the page shows it. */
type Shown = { slug: string; title: string; text: string; facet: string; part?: string; weight: number; state: string; variant?: string; turns: Change[] }

type Leaf = { name: string; path: string[]; value: unknown; perspectives: string[]; tides: string[] }
type Node = { name: string; children: (Node | Leaf)[] }

/** The Settings as a tree: each leaf with the Perspectives and the Tides that can move it. */
function treeOf(settings: Settings, movers: (path: string[]) => { perspectives: string[]; tides: string[] }): Node {
  const grow = (name: string, value: unknown, path: string[]): Node | Leaf =>
    isNode(value) && Object.keys(value).length
      ? { name, children: Object.entries(value).map(([key, child]) => grow(key, child, [...path, key])) }
      : { name, path, value, ...movers(path) }
  return grow('settings', settings, []) as Node
}

/** Every Perspective with its record and what it turns; the Settings as a tree with who can move each leaf. */
export async function perspectivesAnswer() {
  const records = readPerspectives()
  const tides = await readTides()
  const base = defaults(1)
  const perspectives: Shown[] = []
  for (const record of records) {
    const body = parseRecord(readFileSync(join(record.dir, 'perspective.md'), 'utf8'), record.dir, "a Perspective's")
    // heard once, from the defaults, in a Song of the Composer's own: what it turns, and how far
    const { perspectives: heard, settings } = await resolve([record], 'composer', 1)
    perspectives.push({
      slug: record.slug,
      title: record.title,
      text: body.text,
      facet: record.facet,
      ...(record.part ? { part: record.part } : {}),
      weight: record.weight,
      state: record.state,
      ...(heard[0]?.variant ? { variant: heard[0].variant } : {}),
      turns: differences(base, settings),
    })
  }
  const canMove = (path: string[]) => ({
    perspectives: perspectives.filter((p) => p.facet === path[0] && (!p.part || p.part === path[1])).map((p) => p.slug),
    tides: tides.filter((t) => t.moves.facet === path[0] && t.moves.part === path[1] && t.moves.setting === path[2]).map((t) => t.slug),
  })
  const active = records.filter((r) => r.state === 'active')
  return {
    perspectives,
    weight: active.reduce((sum, r) => sum + r.weight, 0),
    // how many can be heard together is a matter of the Facets: two on one cannot, but on different parts
    clashes: active.flatMap((a, i) => active.slice(i + 1).filter((b) => clash(a, b)).map((b) => [a.slug, b.slug])),
    settings: treeOf(base, canMove),
  }
}

// ---- the Tides

/** How many Songs each side of the Song asked for the curves show. */
const reach = 18
/** How many points a curve has to a Song. */
const perSong = 4

/** Every Tide with its record, what it moves, its range, its envelope, and its curve over the Songs around `song`. */
export async function tidesAnswer(song: number) {
  const records = await readTides()
  const from = Math.max(0, song - reach)
  const to = song + reach
  return {
    song,
    window: [from, to],
    tides: records.map((record: TideRecord) => {
      const body = parseRecord(readFileSync(join(record.dir, 'tide.md'), 'utf8'), record.dir, "a Tide's")
      const at = (position: number) => valueAt(record, position)
      const now = at(positionOf(BigInt(song), 0, 1))
      return {
        slug: record.slug,
        title: record.title,
        text: body.text,
        state: record.state,
        moves: record.moves,
        range: validRange[record.moves.setting],
        envelope: { age: record.age, attack: record.attack, hold: record.hold, decay: record.decay, min: record.min, max: record.max, noise: record.noise ?? 0, grain: record.grain ?? 1 },
        now: { value: now.value, phase: now.phase, through: now.through },
        curve: Array.from({ length: (to - from) * perSong + 1 }, (_, i) => {
          const position = from + i / perSong
          return [position, at(position).value]
        }),
      }
    }),
  }
}
