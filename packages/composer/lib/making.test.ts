import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chorusHook, evolve, firstTune, fitToCount, growOnReciting, spacing, variations, type Phrase } from 'melody'
import { arrangementsHome, readArrangements, readParts } from 'parts'
import { arrange, chorusOpening, firstLyrics, stresses, type Lyrics } from 'song'
import { layoutOf } from './layout.js'
import { ageIn, ageOf, bedsAnswer, captionScale, captionsOf, fittedLine, kindOf, lengthOf, lyricsAnswer, piecesOf, sampleVerse, scoreAnswer, sessionFields, songAnswer, syllablesOf, tuneAnswer, wordsOf } from './making.js'

const records = await readParts()
const parts = new Map(records.map(({ part }) => [part.id, part]))
const theSong = (await readArrangements(records)).find(({ arrangement }) => arrangement.id === 'the-song')!.arrangement
const fieldNames = Object.keys(firstLyrics) as (keyof Lyrics)[]
/** What arrange() sings in each place, when every field is given its own name for a text. */
const sung = arrange(Object.fromEntries(fieldNames.map((field) => [field, field])) as Lyrics)

describe('the Tune', () => {
  const plain = (phrases: { notes: [number, number][] }[]) => phrases.map(({ notes }) => notes)
  const own = (phrases: readonly Phrase[]) => phrases.map(({ notes }) => notes.map(([d, b]): [number, number] => [d, b]))

  it("says the Tune's own keys, and draws each key's phrases as the Tune has them, the reciting note ringed", () => {
    const answer = tuneAnswer()
    expect(answer.names as string[]).toEqual(Object.keys(firstTune))
    for (const name of answer.names) expect(plain(answer.born[name]!)).toEqual(own(firstTune[name as keyof typeof firstTune]))
    // the one the melody chants on carries its ring
    const ringed = answer.names.filter((name) => answer.born[name]!.some((phrase) => phrase.reciting !== undefined))
    expect(ringed).toHaveLength(1)
    expect(answer.born[ringed[0]!]!.map((phrase) => phrase.reciting)).toEqual(firstTune.chorus.map((_, i) => chorusHook[i]?.reciting))
  })

  it('says which keys evolve and which stay, and the evolving ones as evolve makes them, the notes that moved marked', () => {
    const answer = tuneAnswer()
    expect([...answer.evolves, ...answer.stays].sort()).toEqual([...answer.names].sort())
    expect(answer.stays).toHaveLength(1)
    expect(answer.evolves).toHaveLength(1)
    let tune = firstTune
    for (const { step, tunes } of answer.evolution) {
      if (step) tune = evolve(tune, `composer:${step}`)
      for (const name of answer.names) expect(plain(tunes[name]!)).toEqual(own(tune[name as keyof typeof tune]))
    }
    // a note is marked exactly where it differs from the Song before
    let before = firstTune
    for (const { step, tunes } of answer.evolution.slice(1)) {
      const next = evolve(before, `composer:${step}`)
      for (const name of answer.names) {
        tunes[name]!.forEach((phrase, i) => {
          phrase.notes.forEach(([degree, beats], n) => {
            const was = before[name as keyof typeof before][i]!.notes[n]!
            expect(phrase.changed[n]).toBe(was[0] !== degree || was[1] !== beats)
          })
        })
      }
      before = next
    }
    expect(answer.evolution.some(({ tunes }) => answer.evolves.some((name) => tunes[name]!.some(({ changed }) => changed.some(Boolean))))).toBe(true)
  })

  it("shows a Song's Variations as variations makes them: the first is the tune itself", () => {
    const answer = tuneAnswer()
    const made = variations(firstTune, 4, 'composer', { ornaments: 1, steps: 1 })
    expect(answer.variations).toHaveLength(4)
    answer.variations.forEach(({ tunes }, v) => {
      for (const name of answer.names) expect(plain(tunes[name]!)).toEqual(own(made[v]![name as keyof typeof made[0]]))
    })
    for (const name of answer.names) expect(answer.variations[0]!.tunes[name]!.every(({ changed }) => changed.every((moved) => !moved))).toBe(true)
    expect(answer.varies).toEqual(answer.evolves)
  })
})

const lyrics = await lyricsAnswer(records, arrangementsHome, 72)
const score = await scoreAnswer(records, 72, 6)
const beds = await bedsAnswer(records, arrangementsHome, 72)
/** Whether the throat's dictionary is built here: on the Mac it is not, and every word is counted by the rough rule. */
const dictionary = await stresses('memory').then((words) => words[0]?.stresses !== undefined).catch(() => false)

describe('the Lyrics', () => {
  it('has the five fields, and the instances of the Arrangement that sing each, as arrange() places them', () => {
    expect(lyrics.fields).toEqual(fieldNames)
    expect(lyrics.fills.map(({ instance }) => instance)).toEqual(theSong.instances.map(({ name }) => name))
    theSong.instances.forEach(({ name }, i) => {
      const fill = lyrics.fills[i]!
      expect(fill.instance).toBe(name)
      // the Song walks the whole order twice, and the second pass continues the words of the first
      expect(fill.field as string | undefined).toBe(sung[i % 10]!.content || undefined)
    })
    // each field is sung once in an iteration by as many instances as arrange() puts it in, and so twice as many in two passes
    for (const field of lyrics.fields) {
      expect(lyrics.fills.filter((fill) => fill.field === field)).toHaveLength(2 * sung.filter(({ content }) => content === field).length)
    }
  })

  it("names the part whose first line is the Song's age, by asking the parts for their fixed lines", () => {
    expect(lyrics.ageIn).toBe(ageIn(records))
    expect(lyrics.ageIn).toBe(theSong.instances.find((_, i) => sung[i % 10]!.content === twiceField())!.part)
    expect(score.ageIn).toBe(lyrics.ageIn)
    function twiceField() {
      return fieldNames.find((field) => sung.filter(({ content }) => content === field).length > 1)
    }
  })

  it("gives each written part's lines their count at three wordinesses, as the part measures them", () => {
    for (const { part, lines } of lyrics.lines) {
      for (const { line, counts } of lines) {
        for (const count of counts) {
          const measured = parts.get(part)!.measure({ line, tune: firstTune, tempo: 72, rate: 6, parameters: { wordiness: count.wordiness } })
          expect(count).toMatchObject(measured)
          expect(count.most).toBeGreaterThanOrEqual(count.target)
        }
        expect(counts[0]!.target).toBeLessThanOrEqual(counts[1]!.target)
        expect(counts[1]!.target).toBeLessThanOrEqual(counts[2]!.target)
      }
    }
    expect(lyrics.lines.map(({ part }) => part).sort()).toEqual([...parts.values()].filter((p) => p.words === 'written').map((p) => p.id).sort())
  })

  it("grows the Song's age as its words outgrow its phrase: not at iteration 1, by a bar or more at 2548", async () => {
    expect(lyrics.age.map(({ iteration }) => iteration)).toEqual([1, 12, 2548])
    expect(lyrics.age.map(({ text }) => text)).toEqual([1n, 12n, 2548n].map(chorusOpening))
    expect(lyrics.age[0]!.grown).toBe(0)
    expect(lyrics.age[2]!.grown).toBeGreaterThanOrEqual(1)
    expect(lyrics.age[2]!.syllables).toBeGreaterThan(lyrics.age[0]!.syllables)
    expect(await ageOf(2548n, 72, 6)).toEqual(lyrics.age[2]!)
  })
})

describe('the words of a line', () => {
  it('counts a word the dictionary does not know by a rough rule, and says so', async () => {
    expect(piecesOf('memory')).toHaveLength(3)
    expect(piecesOf('night')).toHaveLength(1)
    expect(piecesOf('crystal')).toHaveLength(2)
    const [word] = await wordsOf('qzxkvt')
    expect(word!.rough).toBe(true)
    expect(word!.stresses.length).toBeGreaterThan(0)
  })

  it('splits hyphens, strips the stops, and notes a comma', async () => {
    const words = await wordsOf('forty-eight, night,')
    expect(words.map(({ text }) => text)).toEqual(['forty', 'eight', 'night'])
    expect(words.map(({ comma }) => comma)).toEqual([false, true, true])
  })

  it.skipIf(!dictionary)("counts a known word's syllables from the dictionary's vowels, not by the rough rule", async () => {
    const words = await wordsOf("In the crystal memory of a winter's night,")
    expect(words.every(({ rough }) => !rough)).toBe(true)
    expect(syllablesOf(words)).toBe(12)
    const memory = (await wordsOf('memory'))[0]!
    expect(memory.stresses).toHaveLength(3)
    expect((await stresses('memory'))[0]!.stresses).toEqual(memory.stresses)
  })
})

describe('the captions under a line', () => {
  it('sets a word under the note its first syllable is on, and a dash under each that carries the rest', async () => {
    const words = await wordsOf('memory of night')
    const notes: [number, number][] = words.flatMap((word) => word.stresses.map((): [number, number] => [0, 1]))
    const captions = captionsOf(words, notes)
    expect(captions.map(({ text }) => text)).toEqual(words.flatMap((word) => word.stresses.map((_, i) => (i === 0 ? word.text : '–'))))
    expect(captions.map(({ at }) => at)).toEqual(notes.map((_, i) => i))
  })

  it('never lets one caption touch another: on each row, the next begins after the last ends', async () => {
    const lines = [...score.lines, ...score.age]
    // and a line of short notes with long words, the hardest case
    const crowded = await wordsOf('extraordinary circumstances overwhelmingly')
    const crowdedNotes: [number, number][] = crowded.flatMap((word) => word.stresses.map((): [number, number] => [0, 0.25]))
    const sets = [...lines.map(({ captions }) => captions), captionsOf(crowded, crowdedNotes)]
    const { beat, glyph } = captionScale
    for (const captions of sets) {
      expect(captions.length).toBeGreaterThan(0)
      const rows = new Map<number, typeof captions>()
      for (const caption of captions) rows.set(caption.row, [...(rows.get(caption.row) ?? []), caption])
      for (const row of rows.values()) {
        for (let i = 1; i < row.length; i++) expect(row[i]!.at * beat).toBeGreaterThanOrEqual(row[i - 1]!.at * beat + row[i - 1]!.text.length * glyph)
      }
    }
  })

  it('gives every syllable of a fitted line its own caption, so none is lost', () => {
    for (const line of score.lines) {
      expect(line.captions).toHaveLength(line.syllables)
      expect(line.captions.filter(({ text }) => text !== '–')).toHaveLength(line.words.length)
    }
  })
})

describe('the Score', () => {
  it('keeps to the grid the melody says', () => {
    expect(score.k).toBe(spacing(72, 6))
    expect(score.scale).toEqual(captionScale)
  })

  it("fits each sample line to its phrase as fitToCount does, a note to each syllable", async () => {
    expect(score.lines).toHaveLength(sampleVerse.length)
    for (const [i, line] of score.lines.entries()) {
      const words = await wordsOf(sampleVerse[i]!)
      const fit = fitToCount(firstTune.verse[i]!, words.map(({ stresses: s, comma }) => ({ stresses: s, ...(comma ? { comma } : {}) })), spacing(72, 6))
      expect(line.fits).toBe(Boolean(fit))
      if (fit && line.fitted) {
        expect(line.fitted.notes).toEqual(fit.phrase.notes.map(([d, b]) => [d, b]))
        expect(line.fitted.notes).toHaveLength(line.syllables)
        expect(lengthOf(fit.phrase) - lengthOf(firstTune.verse[i]!)).toBe(4 * line.grown)
      }
    }
    expect(score.lines.every(({ fits }) => fits)).toBe(true)
  })

  it('says a line that does not fit, and does not draw one', async () => {
    const tooLong = await fittedLine(firstTune.verse[0]!, 'the words of this line are very many and long and will never be sung in a phrase of so few notes at all', 72, 6)
    expect(tooLong.fits).toBe(false)
    expect(tooLong.fitted).toBeUndefined()
    expect(tooLong.captions).toEqual([])
  })

  it("grows the refrain's first line on its reciting note, as growOnReciting does", async () => {
    const phrase = { ...firstTune.chorus[0]!, reciting: chorusHook[0]!.reciting }
    for (const item of score.age) {
      const words = await wordsOf(item.text)
      const grown = growOnReciting(phrase as Phrase, words.map(({ stresses: s, comma }) => ({ stresses: s, ...(comma ? { comma } : {}) })), score.k)
      expect(item.fitted?.notes).toEqual(grown?.notes.map(([d, b]) => [d, b]))
      expect(item.grownBars).toBe(grown ? Math.round((lengthOf(grown) - lengthOf(firstTune.chorus[0]!)) / 4) : undefined)
    }
    expect(score.age.at(-1)!.grownBars).toBeGreaterThanOrEqual(1)
  })

  it('is the same Score at the same tempo and another at another', async () => {
    expect(await scoreAnswer(records, 72, 6)).toEqual(score)
    expect((await scoreAnswer(records, 120, 6)).k).toBe(spacing(120, 6))
  })
})

describe('the Beds', () => {
  it("asks for a bed to each part: the part's name, or, with no words, the parts either side of it", () => {
    const expected = sung.map((part, i) => (part.content ? part.type : `${part.type}:${sung[i - 1]!.type}>${sung[i + 1]!.type}`))
    // twice: the Song walks the whole order twice
    expect(beds.kinds.map(({ kind }) => kind)).toEqual([...expected, ...expected])
    expect(beds.kinds.filter(({ kind }) => kind.includes('>'))).toHaveLength(8)
    expect(kindOf(parts.get(theSong.instances[0]!.part)!)).toBe(theSong.instances[0]!.part)
  })

  it("makes a guide from a section's words: chords that begin at the start and reach the end, a bass and an upper voice", () => {
    const guide = beds.guide!
    expect(guide.syllables).toBeGreaterThan(30)
    expect(guide.chords[0]!.at).toBe(0)
    let at = 0
    for (const chord of guide.chords) {
      expect(chord.at).toBeCloseTo(at, 9)
      at += chord.beats
      expect(chord.root).toBeGreaterThanOrEqual(0)
      expect(chord.root).toBeLessThanOrEqual(6)
    }
    expect(at).toBeCloseTo(guide.beats, 6)
    expect(guide.lower.length).toBeGreaterThan(0)
    expect(guide.upper.length).toBeGreaterThan(0)
    expect(guide.furthest).toBeGreaterThanOrEqual(0)
  })

  it('is the same guide each time', async () => {
    expect(await bedsAnswer(records, arrangementsHome, 72)).toEqual(beds)
  })
})

const song = await songAnswer(records, arrangementsHome, 72)

describe('the Song', () => {
  const answer = song
  const layout = layoutOf(theSong, parts, firstTune, 72)

  it("lays the Arrangement out as a Session's parts would be: in order, with kinds, words and timing", () => {
    expect(answer.parts.map(({ instance }) => instance)).toEqual(theSong.instances.map(({ name }) => name))
    expect(answer.parts.map(({ words }) => words as string | undefined)).toEqual([...sung, ...sung].map(({ content }) => content || undefined))
    // where the timeline puts them: the same as the tune's beats at one tempo, to the last digit a sum of seconds keeps
    answer.parts.forEach(({ start }, i) => expect(start).toBeCloseTo(layout.instances[i]!.startSeconds, 9))
    expect(answer.seconds).toBeCloseTo(layout.seconds, 9)
    expect(answer.parts.map(({ kind }) => kind)).toEqual(beds.kinds.map(({ kind }) => kind))
  })

  it("says only fields a Session has: each is a field of the Archive's own type", () => {
    const source = readFileSync(fileURLToPath(new URL('../../archive/lib/session.ts', import.meta.url)), 'utf8')
    const body = source.slice(source.indexOf('export type Session = {'))
    const end = body.indexOf('\n}\n')
    const declared = new Set([...body.slice(0, end).matchAll(/^ {2}(\w+)\??:/gm)].map((match) => match[1]!))
    expect(declared.size).toBeGreaterThan(10)
    for (const { name } of sessionFields) expect(declared.has(name)).toBe(true)
    expect(answer.session).toEqual(sessionFields as unknown as typeof answer.session)
  })
})
