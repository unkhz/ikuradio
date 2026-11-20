import { expect, test } from 'bun:test'
import type { Session } from 'archive'
import { presentOf } from './present.js'

const line = (text: string) => ({ text })
const session = {
  song: '1',
  iterations: [
    { parts: [{ lines: [line('the lantern echoes over the harbor'), line('a lantern echoes in the rain')] }] },
    { parts: [{ lines: [line('the lantern echoes, the lantern burns'), line('echoes of a harbor lantern')] }] },
  ],
} as unknown as Session
const robot = Array.from({ length: 30 }, (_, i) => `The robot thought number ${i} about a ship in the dark, long enough to be a memory of its own.`)

test('a prompt is made of the Song: its own thought, its worn words, and a handful of the robot, whatever the moment', async () => {
  const present = await presentOf({ sessions: [session], own: ['I would keep the lantern.'], heard: robot, mood: ['rain'], random: () => 0.3 })
  expect(present.memories.own).toEqual(['I would keep the lantern.'])
  expect(present.memories.heard.length).toBeGreaterThan(0)
  expect(present.memories.heard.length).toBeLessThan(robot.length)
  // the word the Song leaned on in both its iterations is worn deep, and is not also resting
  expect(present.deep).toContain('lantern')
  expect(present.resting).not.toContain('lantern')
})

test('the robot is heard at random: another draw, other thoughts', async () => {
  const a = await presentOf({ sessions: [session], own: [], heard: robot, mood: ['rain'], random: () => 0.1 })
  const b = await presentOf({ sessions: [session], own: [], heard: robot, mood: ['rain'], random: () => 0.9 })
  expect(a.memories.heard).not.toEqual(b.memories.heard)
})
