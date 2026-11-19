// What the page loads of the DJs, once (plan "Intro with Rezzy"): each one's
// voice, how their body moves, and how a speech becomes a take for the
// throat and the movements. Built to ../ui/public/dj.js by `bun run dj`.
import { djs, movementsOf, taken } from './index.js'

;(globalThis as unknown as { djs: unknown }).djs = Object.fromEntries(
  Object.values(djs).map((dj) => [dj.name, { name: dj.name, title: dj.title, body: dj.voice.body, take: (speech: Parameters<typeof taken>[1]) => taken(dj, speech), movements: (speech: Parameters<typeof movementsOf>[0]) => movementsOf(speech, dj.movements) }]),
)
