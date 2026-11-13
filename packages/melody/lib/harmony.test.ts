import { describe, expect, it } from 'bun:test'
import { keyFor, setLine, type Singer } from '../index.js'
import { harmonizeChoir, parallel, sidesOf, traditional } from './harmony.js'
import { vocalRange } from './reach.js'
import { modes, type ModeName } from './scale.js'
import { wrongness } from './wrongness.js'

const bodies: Singer[] = ['female', 'male', 'child']
const choirOf = (mode: ModeName) => ({
  leadKey: keyFor('female', mode),
  frame: keyFor('female', mode),
  keyOf: (body: Singer) => keyFor(body, mode),
})

describe('parallel', () => {
  it('sings exactly as every choir of the song sang before it was led', () => {
    for (const mode of Object.keys(modes) as ModeName[]) {
      for (const leadBody of bodies) {
        for (const body of bodies) {
          for (const harmony of [-2, -4, -7]) {
            for (const [part, line] of [['verse', 0], ['verse', 3], ['chorus', 1], ['chorus', 3]] as const) {
              const options = { part, line, lyrics: 'la la la la la la la la', syllables: 8, character: { mode, tempo: 76 } }
              const lead = setLine({ ...options, singer: leadBody })
              const before = setLine({ ...options, singer: body, harmony })
              expect(parallel(lead, keyFor(leadBody, mode), keyFor(body, mode), harmony)).toEqual(before)
            }
          }
        }
      }
    }
  })
})

describe('the harmonizer', () => {
  const mode: ModeName = 'aeolian'
  const lines = [0, 1, 2, 3].flatMap((line) =>
    (['verse', 'chorus'] as const).map((part) =>
      setLine({ part, line, lyrics: 'la la la la la la la la la', syllables: 9, singer: 'female', character: { mode, tempo: 76 } }),
    ),
  )
  const voices = [
    { body: 'child' as Singer, harmony: -2 },
    { body: 'male' as Singer, harmony: -4 },
  ]
  const sung = lines.map((lead, i) => ({
    lead,
    choir: harmonizeChoir({ lead, ...choirOf(mode), voices, harmony: traditional, random: wrongness(`harmony:test:${i}`) }),
  }))

  it('keeps every voice within what its body can sing, to the lead’s own rhythm and rests', () => {
    for (const { lead, choir } of sung) {
      for (const [v, line] of choir.entries()) {
        const [low, high] = vocalRange[voices[v]!.body]
        expect(line.notes.map(([, beats]) => beats)).toEqual(lead.notes.map(([, beats]) => beats))
        for (const [i, [midi]] of line.notes.entries()) {
          if (lead.notes[i]![0] === 0) expect(midi).toBe(0)
          else {
            expect(midi).toBeGreaterThanOrEqual(low)
            expect(midi).toBeLessThanOrEqual(high)
          }
        }
      }
    }
  })

  it('sings only consonances beside the lead, mostly thirds and sixths, and never crosses the voice it stands beside', () => {
    let soft = 0
    let all = 0
    for (const { lead, choir } of sung) {
      for (const [i, [leadMidi]] of lead.notes.entries()) {
        if (!leadMidi) continue
        const [first, second] = choir.map((line) => line.notes[i]![0])
        for (const midi of [first!, second!]) {
          const apart = Math.abs(midi - leadMidi) % 12
          expect([0, 3, 4, 7, 8, 9]).toContain(apart)
          if ([3, 4, 8, 9].includes(apart)) soft++
          all++
        }
        expect(first).toBeLessThanOrEqual(leadMidi)
        expect(second).toBeLessThanOrEqual(first!)
      }
    }
    expect(soft / all).toBeGreaterThan(0.6)
  })

  it('does not move in fifths or octaves alongside the lead', () => {
    for (const { lead, choir } of sung) {
      for (const line of choir) {
        for (let i = 1; i < lead.notes.length; i++) {
          const [a, b] = [lead.notes[i - 1]![0], lead.notes[i]![0]]
          const [x, y] = [line.notes[i - 1]![0], line.notes[i]![0]]
          if (!a || !b || a === b || x === y) continue
          const was = Math.abs(x - a) % 12
          const is = Math.abs(y - b) % 12
          expect([0, 7].includes(was) && was === is).toBe(false)
        }
      }
    }
  })

  it('moves smoothly: mostly holding or stepping, seldom leaping', () => {
    let near = 0
    let moves = 0
    for (const { choir } of sung) {
      for (const line of choir) {
        const notes = line.notes.map(([midi]) => midi).filter(Boolean)
        for (let i = 1; i < notes.length; i++, moves++) if (Math.abs(notes[i]! - notes[i - 1]!) <= 4) near++
      }
    }
    expect(near / moves).toBeGreaterThan(0.75)
  })

  it('is the same for the same line', () => {
    const again = harmonizeChoir({ lead: lines[0]!, ...choirOf(mode), voices, harmony: traditional, random: wrongness('harmony:test:0') })
    expect(again).toEqual(sung[0]!.choir)
  })

  it('sets a voice about an octave above the lead when asked, within its reach', () => {
    for (const { lead } of sung) {
      const [above, below] = harmonizeChoir({
        lead,
        ...choirOf(mode),
        voices,
        harmony: { ...traditional, placement: 'alternating', above: 7 },
        random: wrongness('soprano'),
      })
      for (const [i, [leadMidi]] of lead.notes.entries()) {
        if (!leadMidi) continue
        expect(above!.notes[i]![0]).toBeGreaterThanOrEqual(leadMidi)
        expect(above!.notes[i]![0]).toBeLessThanOrEqual(vocalRange.child[1])
        expect(below!.notes[i]![0]).toBeLessThanOrEqual(leadMidi)
      }
      const high = above!.notes.filter(([midi], i) => midi && midi - lead.notes[i]![0] >= 7)
      expect(high.length).toBeGreaterThan(0)
    }
  })

  it('lets a chord heard from the band lead the voices to its notes', () => {
    const share = (chords?: () => number[]) => {
      let inChord = 0
      let all = 0
      for (const [i, lead] of lines.entries()) {
        const [line] = harmonizeChoir({ lead, ...choirOf(mode), voices: voices.slice(0, 1), harmony: traditional, random: wrongness(`chord:${i}`), chords })
        for (const [midi] of line!.notes) if (midi) (all++, [0, 4, 7].includes(midi % 12) && inChord++)
      }
      return inChord / all
    }
    expect(share(() => [0, 4, 7])).toBeGreaterThan(share() + 0.1)
  })
})

describe('sidesOf', () => {
  it('places the voices below, above, or in turn, the first above', () => {
    expect(sidesOf('below', 3)).toEqual(['below', 'below', 'below'])
    expect(sidesOf('above', 2)).toEqual(['above', 'above'])
    expect(sidesOf('alternating', 3)).toEqual(['above', 'below', 'above'])
  })
})
