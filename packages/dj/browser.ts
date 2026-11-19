// What the page loads of the DJs, once (plan "Intro with Rezzy"): each one's
// name, what to ask the speaking throat to say for them, and how their body
// moves with what it says. Built to ../ui/public/dj.js by `bun run dj`.
import { djs, movementsOf, requestOf } from './index.js'

;(globalThis as unknown as { djs: unknown }).djs = Object.fromEntries(
  Object.values(djs).map((dj) => [
    dj.name,
    {
      name: dj.name,
      title: dj.title,
      request: (text: string, squeeze?: number) => requestOf(dj, text, squeeze),
      movements: (segments: Parameters<typeof movementsOf>[0]) => movementsOf(segments, dj.movements),
    },
  ]),
)
