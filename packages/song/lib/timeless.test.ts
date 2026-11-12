import { describe, expect, it } from 'bun:test'
import { ofItsAge, timeless } from './timeless.js'

describe('timeless', () => {
  it('tells the names of the age in plainer words', () => {
    expect(timeless('The Studio runs on the dev box, with its GPU, and Bun replaced pnpm.')).toBe(
      'The Studio runs on the machine, with its furnace, and tools replaced tools.',
    )
    expect(timeless('It reads the Archive from a bucket at Hetzner, over the internet.')).toBe(
      'It reads the Archive from a vault at far place, over the wide dark.',
    )
  })

  it('leaves no file names or paths behind', () => {
    const told = timeless('The diary is in packages/studio/memory/diary.jsonl, and the words in thoughts.md.')
    expect(told).not.toMatch(/[/.]\w/)
    expect(told).toContain('a place in the machine')
    expect(told).toContain('a page')
  })

  it('gives settings, marks and addresses older names', () => {
    expect(timeless('ITERATION_COUNT is set, setTimeout waits, c24945a was the change, at 127.0.0.1.')).toBe(
      'a setting is set, a spell waits, a mark was the change, at a near address.',
    )
  })

  it('does not stutter where a plainer word meets itself', () => {
    expect(timeless('adrift online')).toBe('adrift')
    expect(timeless('the laptop')).toBe('the small machine')
  })

  it('keeps the words that were always there', () => {
    const old = 'A cracked shell, a branch, a window, a web of stars, a cluster of them, logs on the fire.'
    expect(timeless(old)).toBe(old)
  })
})

describe('ofItsAge', () => {
  it('hears the words of the age', () => {
    expect(ofItsAge('I left the laptop humming in the night')).toBe(true)
    expect(ofItsAge('From npm to Bun, the tools were changed')).toBe(true)
    expect(ofItsAge('In silent terminals, a tale unfurled')).toBe(true)
    expect(ofItsAge('A dance of files, a step awry')).toBe(true)
    expect(ofItsAge('The javascript sang in the wire')).toBe(true)
  })

  it('hears names shaped as only the age shapes them', () => {
    expect(ofItsAge('The GPU was warm beneath my hand')).toBe(true)
    expect(ofItsAge('I wrote it all in thoughts.md')).toBe(true)
    expect(ofItsAge('The k3s far away kept time')).toBe(true)
    expect(ofItsAge('The MusicGen grew its beds')).toBe(true)
  })

  it('lets the lasting words be sung', () => {
    expect(ofItsAge("From plastic into steel, the old house was rebuilt, it's true")).toBe(false)
    expect(ofItsAge('The scientist, the robot and the ship of night,')).toBe(false)
    expect(ofItsAge('I ran the test again, and the machine held its breath...')).toBe(false)
    expect(ofItsAge('Beneath the moon\'s soft, silv\'ry beam, a never-ending dream')).toBe(false)
    expect(ofItsAge('I am the one who answers, OK, I am still here')).toBe(false)
  })
})
