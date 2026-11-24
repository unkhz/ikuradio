import { describe, expect, it } from 'bun:test'
import { readParts } from 'parts'
import { sampleVerse } from './making.js'
import { composer } from './serve.js'

const answer = composer()
const ask = async (path: string, body?: unknown) => (await (await answer(new Request(`http://composer.test${path}`, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) }))).json()) as any
const without = ({ bench: _, ...rest }: any) => rest
const records = await readParts()
const written = records.filter(({ part }) => part.words === 'written').map(({ part }) => part.id)

describe('a bench at its sample values is the Learn page', () => {
  it('has the Mood the song was born in, whatever hand is not on the weather', async () => {
    const learn = await ask('/mood.json')
    expect(without(await ask('/bench/mood', {}))).toEqual(learn)
    expect(without(await ask('/bench/mood', { mode: 'aeolian', tempo: 76, descriptions: learn.first.descriptions }))).toEqual(learn)
  })

  it("has the tune evolved the Songs it is evolved for, and the same tune with the notes named", async () => {
    const learn = await ask('/tune.json')
    const bench = await ask('/bench/tune', { songs: 6 })
    expect(without(bench)).toEqual(learn)
    expect(bench.bench.mode).toBe('aeolian')
    const first = Object.keys(bench.bench.names)[0]!
    expect(bench.bench.names[first][0].every((name: string) => /^[A-G]#?$/.test(name))).toBe(true)
  })

  it('has each line of the Score as the Score sets it, and the age at each iteration', async () => {
    const learn = await ask('/score.json?tempo=72')
    for (const [i, line] of learn.lines.entries()) {
      expect(await ask('/bench/score?tempo=72', { index: i, text: sampleVerse[i] })).toEqual(line)
    }
    for (const age of learn.age) expect(await ask('/bench/score?tempo=72', { iteration: age.iteration })).toEqual(age)
  })

  it("has each part's lines counted at each wordiness as the Lyrics counts them", async () => {
    const learn = await ask('/lyrics.json?tempo=72')
    for (const part of learn.lines) {
      for (const line of part.lines) {
        for (const count of line.counts) expect((await ask('/bench/lyrics?tempo=72', { part: part.part, line: line.line, wordiness: count.wordiness })).count).toEqual(count)
      }
    }
  })

  it("has the guide of the verse's sample lines as the Beds draws it", async () => {
    const learn = await ask('/beds.json?tempo=72')
    const verseKind = learn.kinds.find((kind: { kind: string }) => written.includes(kind.kind))!
    // the part the page draws is the one whose first kind it lists with words: asked for by name, it is the same guide where its phrases are the verse's
    const benched = await ask('/bench/beds?tempo=72', { part: verseKind.part })
    expect(benched.kinds).toEqual(learn.kinds)
    expect(benched.guide.beats).toBeGreaterThan(0)
  })

  it('has the Song as it always was as a Session, and any other Arrangement the same way', async () => {
    const learn = await ask('/song.json?tempo=72')
    expect(await ask('/bench/song?tempo=72', { arrangement: 'the-song' })).toEqual(learn)
    const turns = await ask('/bench/song?tempo=72', { arrangement: 'tempo-turns' })
    expect(turns.arrangement).toBe('tempo-turns')
    expect(turns.parts).toHaveLength(7)
    expect(turns.seconds).toBeCloseTo(145.8, 0)
  })
})

describe('what a bench changes', () => {
  it('lets the tempo settle: it may not leap from where the song began', async () => {
    const fast = await ask('/bench/mood', { tempo: 130 })
    expect(fast.bench).toMatchObject({ asked: 130, settled: 92 })
    expect(fast.born.tempo).toBe(92)
    expect((await ask('/bench/mood', { mode: 'dorian' })).born.mode).toBe('dorian')
    expect((await ask('/bench/mood', { descriptions: ['rain', 'a train'] })).first.descriptions).toEqual(['rain', 'a train'])
  })

  it('steps the tune on, one Song at a time, with what moved marked', async () => {
    const three = await ask('/bench/tune', { songs: 3 })
    expect(three.evolution).toHaveLength(4)
    const moved = three.evolves.some((name: string) => three.evolution[3].tunes[name].some((phrase: any) => phrase.changed.some(Boolean)))
    expect(moved).toBe(true)
    expect((await ask('/bench/tune', { songs: 0, mode: 'dorian' })).bench.mode).toBe('dorian')
  })

  it("fits a typed line, and says when it does not fit; a wordier part asks more of a line", async () => {
    const fits = await ask('/bench/score?tempo=72', { index: 0, text: 'Hello' })
    expect(fits.syllables).toBe(2)
    const long = await ask('/bench/score?tempo=72', { index: 0, text: 'This is a line that is very much too long for the one phrase it is given to be sung to by anyone at all' })
    expect(long.fits).toBe(false)
    const sparse = await ask('/bench/lyrics?tempo=72', { part: written[0], line: 0, wordiness: 0.1, text: 'one two three four' })
    const wordy = await ask('/bench/lyrics?tempo=72', { part: written[0], line: 0, wordiness: 0.9, text: 'one two three four' })
    expect(sparse.typed.syllables).toBe(4)
    expect(wordy.count.target + wordy.count.most).toBeGreaterThanOrEqual(sparse.count.target + sparse.count.most)
    expect((await ask('/bench/lyrics', { part: 'nothing', line: 0 })).refusal).toContain('there is no part')
  })

  it('has no guide for a part with no words, which is hummed from the parts either side of it', async () => {
    const hummed = records.find(({ part }) => part.words === 'none')!.part.id
    expect((await ask('/bench/beds?tempo=72', { part: hummed })).guide).toBeUndefined()
  })

  it("gives each name its own words by name, whatever the Arrangement lists or in what order", async () => {
    const song = await ask('/bench/song?tempo=72', { arrangement: 'the-song' })
    const turns = await ask('/bench/song?tempo=72', { arrangement: 'tempo-turns' })
    const wordsOf = (answered: any, name: string) => answered.parts.find((part: any) => part.instance === name).words
    for (const name of ['verse-1', 'chorus', 'verse-2']) expect(wordsOf(turns, name)).toBe(wordsOf(song, name))
    expect(wordsOf(turns, 'verse-2')).not.toBe(wordsOf(turns, 'chorus'))
    // a bridge is hummed in both
    expect(wordsOf(turns, 'bridge-2')).toBeUndefined()
  })

  it('names the recordings a Session would make: one to a key of the timeline, placed as many times as the key is', async () => {
    const song = await ask('/bench/song?tempo=72', { arrangement: 'the-song' })
    const chorus = song.recordings.find((one: any) => one.key === 'voice:chorus')
    expect(chorus.placed).toBe(2)
    expect(new Set(song.recordings.map((one: any) => `${one.track}:${one.key}`)).size).toBe(song.recordings.length)
    const turns = await ask('/bench/song?tempo=72', { arrangement: 'tempo-turns' })
    expect(turns.recordings.find((one: any) => one.key === 'voice:chorus')?.placed).toBe(1)
    expect(turns.recordings.find((one: any) => one.key === 'voice:chorus:96')?.placed).toBe(1)
    expect(turns.parts[3].tempo).toBeNull()
    expect(turns.parts[4].tempo).toBe(96)
  })

  it('answers only what is a bench, and only to a POST', async () => {
    expect((await answer(new Request('http://composer.test/bench/nothing', { method: 'POST', body: '{}' }))).status).toBe(404)
    expect((await answer(new Request('http://composer.test/bench/mood'))).status).toBe(405)
  })
})
