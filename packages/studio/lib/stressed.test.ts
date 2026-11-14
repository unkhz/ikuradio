import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { chorusHook, setLine, verseWalk, type Syllables } from 'melody'
import { stresses } from 'song'
import { humanize, prepareLyrics, quickest } from 'vocals'
import { stressedLine } from './stressed.js'

const lines = readFileSync(new URL('./fixtures/archive-lines.txt', import.meta.url), 'utf8').split('\n').filter(Boolean)
// the throat's dictionary is there only where the throat has been built
const dictionary = await stresses('a').then(
  () => true,
  () => false,
)

describe('stressedLine', () => {
  it('fills a word the dictionary does not know from the throat, its weight on the first syllable', async () => {
    const read = async () => [
      { text: 'ikuradio', stresses: undefined, comma: false },
      { text: 'sings', stresses: [1], comma: true },
    ]
    expect(await stressedLine('ikuradio sings,', 6, { read, count: async () => 5 })).toEqual([
      { stresses: [1, 0, 0, 0, 0], comma: false },
      { stresses: [1], comma: true },
    ])
  })

  it('gives up, rather than guess, when the words do not add up to what the throat counts', async () => {
    const read = async () => [{ text: 'fire', stresses: [1, 0], comma: false }]
    expect(await stressedLine('fire', 1, { read, count: async () => 1 })).toBeUndefined()
  })
})

describe.skipIf(!dictionary)('lines from the Archive, fitted bar by bar', () => {
  it('never sing a syllable sooner than a sixth of a second after the one before, at any tempo', async () => {
    let fitted = 0
    for (const [n, line] of lines.entries()) {
      const words = (await stresses(prepareLyrics(line))).map(({ stresses, comma }) => ({ stresses, comma }))
      if (words.some(({ stresses }) => !stresses)) continue
      const known = words as Syllables[]
      const syllables = known.reduce((sum, { stresses }) => sum + stresses.length, 0)
      const chorus = line.startsWith('This is the song')
      for (const tempo of [60, 76, 92, 116]) {
        const score = setLine({
          part: chorus ? 'chorus' : 'verse',
          line: chorus ? 0 : n % 4,
          lyrics: line,
          syllables,
          singer: 'female',
          character: { mode: 'aeolian', tempo },
          rate: 6,
          words: known,
        })
        expect(score.notes.filter(([midi]) => midi)).toHaveLength(syllables)
        expect(quickest(humanize(score, `${n}:${tempo}`, 1.6, 6))).toBeGreaterThanOrEqual(1 / 6 - 1e-9)
        fitted++
      }
    }
    expect(fitted).toBeGreaterThan(lines.length)
    void chorusHook
    void verseWalk
  })
})
