import { describe, expect, it } from 'bun:test'
import { attentions } from './thoughts.js'
import { ofItsAge } from './timeless.js'
import { allVocabulary, drawVocabulary, vocabulary, vocabularyNote } from './vocabulary.js'

describe('abundant timeless vocabulary', () => {
  it('provides hundreds of unique, lowercase, timeless words across many domains without worn clichés', () => {
    expect(Object.keys(vocabulary).length).toBeGreaterThanOrEqual(12)
    const flat = Object.values(vocabulary).flat()
    expect(flat.length).toBe(allVocabulary.length)
    expect(allVocabulary.length).toBeGreaterThanOrEqual(450)
    const lower = allVocabulary.map((w) => w.toLowerCase())
    expect(new Set(lower).size).toBe(allVocabulary.length)
    for (const word of allVocabulary) {
      expect(word as string).toBe(word.toLowerCase())
      expect(ofItsAge(word)).toBe(false)
    }
    const cliches = ['whisper', 'echo', 'shadow', 'twilight', 'tapestry', 'ethereal', 'unfurl', 'intertwine']
    for (const cliche of cliches) {
      expect(allVocabulary).not.toContain(cliche)
    }
  })

  it('draws distinct cross-domain words and respects stem-level avoidance', () => {
    const drawn = drawVocabulary({ avoid: ['lanterns', 'basalt', 'echoing'], count: 10 })
    expect(drawn).toHaveLength(10)
    expect(new Set(drawn).size).toBe(10)
    expect(drawn).not.toContain('lantern')
    expect(drawn).not.toContain('basalt')
  })

  it('formats a concise optional vocabulary note', () => {
    expect(vocabularyNote([])).toBe('')
    const note = vocabularyNote(['basalt', 'heron', 'kiln'])
    expect(note).toContain('basalt, heron, kiln')
  })

  it('provides abundant unique reflection attentions for the mind', () => {
    expect(attentions.length).toBeGreaterThanOrEqual(30)
    expect(new Set(attentions).size).toBe(attentions.length)
  })
})
