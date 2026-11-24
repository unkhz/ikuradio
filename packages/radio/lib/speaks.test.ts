import { describe, expect, it } from 'bun:test'
import type { Session } from 'archive'
import { aboutOf, arrangementName, cardOf, excerptOf, headlineOf, paceOf, partsOf, rowsOf, speak, structured } from './speaks.js'

const page = `<html><head>
    <title>ikuradio</title>
  </head><body>
      <p id="offered" hidden></p>
      <dl id="details"></dl>
      <details id="parts" hidden>
        <summary>structure</summary>
        <ol></ol>
      </details>
      <figure id="thought" hidden>
        <figcaption>the mind</figcaption>
        <p></p>
      </figure>
</body></html>`

/** A Session whose words need escaping, everywhere they can. */
const session = {
  song: '1234',
  name: 'Hollow death, by boredom',
  mood: ['<script>alert("rain")</script>', 'gears & cogs'],
  mode: 'dorian',
  tempo: 80,
  choir: 'a woman\'s voice, with a "child"',
  sound: 'oud </script><!-- & $& darbuka',
  perspectives: [{ slug: 'a', title: 'A chorus coming home', facet: 'progression' }, { slug: 'b', title: 'Walking verses', facet: 'progression', variant: 'ii-V-I' }],
  thought: 'I wonder <b>who</b> hears me & why $1',
  seconds: 492,
  iterations: [{ iteration: '1000' }, { iteration: '1001' }],
} as unknown as Session

const url = 'https://ikurad.io/s/1234/hollow-death-by-boredom'

describe('a Song page that speaks', () => {
  const told = speak(page, cardOf(session), url)

  it('serves the panel rows as the page writes them, marked as served, everything escaped', () => {
    const details = /<dl id="details" data-served>([\s\S]*?)<\/dl>/.exec(told)![1]!
    expect(details).toContain('<dt>name</dt><dd>Hollow death, by boredom</dd>')
    expect(details).toContain('<dt>song</dt><dd>1,234</dd>')
    expect(details).toContain('<dt>arrangement</dt><dd>The Song as it always was</dd>')
    expect(details).toContain('<dt>weather</dt><dd>&lt;script&gt;alert(&quot;rain&quot;)&lt;/script&gt; + gears &amp; cogs</dd>')
    expect(details).toContain('<dt>key</dt><dd>dorian, 80 bpm</dd>')
    expect(details).toContain('<dt>choir</dt><dd>a woman&#39;s voice, with a &quot;child&quot;</dd>')
    expect(details).toContain('<dt>band</dt><dd>oud &lt;/script&gt;&lt;!-- &amp; $&amp; darbuka</dd>')
    expect(details).toContain('<dt>heard</dt><dd>A chorus coming home, Walking verses: ii-V-I</dd>')
    expect(details).toContain('<dt>length</dt><dd>8 minutes, iterations 1,000 to 1,001</dd>')
    expect(details).not.toContain('<script>')
  })

  it('offers the Song by its number and name, above the play button, marked as served', () => {
    expect(told).toContain('<p id="offered" data-served>Song 1,234 · Hollow death, by boredom</p>')
  })

  it('shows the thought, escaped', () => {
    expect(told).toContain('<figure id="thought">')
    expect(told).toContain('<p>I wonder &lt;b&gt;who&lt;/b&gt; hears me &amp; why $1</p>')
  })

  it('carries the Song as a MusicRecording no words can break out of', () => {
    const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(told)![1]!
    expect(block).not.toMatch(/[<>]/)
    const data = JSON.parse(block)
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'MusicRecording',
      name: 'Hollow death, by boredom',
      url,
      duration: 'PT8M12S',
      keywords: '<script>alert("rain")</script>, gears & cogs',
      inLanguage: 'en',
      byArtist: { '@type': 'MusicGroup', name: 'ikuradio' },
    })
    expect(told.indexOf('application/ld+json')).toBeLessThan(told.indexOf('</head>'))
  })

  it('never links to the sound', () => {
    expect(told).not.toMatch(/href=|sessions\/|recordings\//)
  })

  it('tells nothing of a Song not yet aired', () => {
    expect(speak(page, undefined, url)).toBe(page)
  })

  it('leaves out what a Session does not have', () => {
    const plain = cardOf({ ...session, sound: undefined, perspectives: undefined, thought: undefined, name: undefined, choir: '', iterations: [{ iteration: '7' }] } as unknown as Session)
    expect(rowsOf(plain).map(([name]) => name)).toEqual(['song', 'arrangement', 'weather', 'key', 'length'])
    expect(rowsOf(plain).at(-1)![1]).toBe('8 minutes, iteration 7')
    const told = speak(page, plain, url)
    expect(told).toContain('<figure id="thought" hidden>')
    expect(told).toContain('<p id="offered" data-served>Song 1,234</p>')
    expect(told).toContain('<dl id="details" data-served><dt>song</dt>')
    expect(structured(plain, url)).toContain('"name":"Song 1,234"')
  })

  it('names Arrangements from title, legacy default, or slug, and SSRs per-part structure and multi-tempo pace', () => {
    expect(arrangementName(undefined, undefined)).toBe('The Song as it always was')
    expect(arrangementName('the-song', undefined)).toBe('The Song as it always was')
    expect(arrangementName('the-long-breath', undefined)).toBe('The Long Breath')
    expect(arrangementName('the-long-breath', 'The Long Breath <live>')).toBe('The Long Breath <live>')

    const varied = cardOf({
      ...session,
      arrangement: 'the-long-breath',
      arrangementTitle: 'The Long Breath',
      tempo: 65,
      tracks: ['drone', 'pulse'],
      iterations: [
        {
          iteration: '4192',
          parts: [
            { type: 'verse', at: 0, seconds: 24, lines: [{ text: 'a' }, { text: 'b' }] },
            { type: 'bridge', at: 24, seconds: 12, tempo: null, lines: [] },
            { type: 'chorus', at: 36, seconds: 28, tempo: 96, mode: 'lydian', lines: [{ text: 'c' }] },
          ],
        },
      ],
    } as unknown as Session)

    expect(paceOf(varied)).toBe('65–96 bpm, free time')
    expect(rowsOf(varied)).toContainEqual(['arrangement', 'The Long Breath'])
    expect(rowsOf(varied)).toContainEqual(['key', 'dorian, 65–96 bpm, free time'])
    expect(rowsOf(varied)).toContainEqual(['tracks', 'drone, pulse'])
    expect(partsOf(varied)).toEqual({
      summary: 'structure · 3 parts',
      items: [
        { label: 'verse', meta: '24s · 65 bpm · 2 lines' },
        { label: 'bridge', meta: '12s · free time' },
        { label: 'chorus', meta: '28s · 96 bpm · lydian · 1 line' },
      ],
    })
    const html = speak(page, varied, url)
    expect(html).toContain('<details id="parts" data-served><summary>structure · 3 parts</summary><ol>')
    expect(html).toContain('<li><span class="part-type">bridge</span><span class="part-meta">12s · free time</span></li>')
    expect(html).toContain('<li><span class="part-type">chorus</span><span class="part-meta">28s · 96 bpm · lydian · 1 line</span></li>')
  })
})

describe('what a crawler is told', () => {
  const plain = { ...session, name: 'Whispers of Twilight', mood: ['drizzling rooftops', "twilight's soft hues"] } as unknown as Session

  it('titles a Song by its name and its weather, and the radio last', () => {
    expect(headlineOf(cardOf(plain), 'ikuradio')).toBe("Whispers of Twilight · drizzling rooftops + twilight's soft hues · ikuradio")
  })

  it('titles a Song with no name by its number, and with no weather by its name alone', () => {
    expect(headlineOf(cardOf({ ...plain, name: undefined } as unknown as Session), 'ikuradio')).toContain('Song 1,234 · ')
    expect(headlineOf(cardOf({ ...plain, mood: [] } as unknown as Session), 'ikuradio')).toBe('Whispers of Twilight · ikuradio')
  })

  it('excerpts a Song by its intro, whole', () => {
    const card = cardOf(plain, ' Listen, the night whispers.\n A snowflake, defiant. ')
    expect(excerptOf(card)).toBe('Listen, the night whispers. A snowflake, defiant.')
  })

  it('cuts a long intro where a sentence ends', () => {
    const sentence = 'The night whispers and the snow keeps falling on the quiet roofs of the town. '
    const card = cardOf(plain, sentence.repeat(8))
    const excerpt = excerptOf(card)
    expect(excerpt.length).toBeLessThanOrEqual(300)
    expect(excerpt.endsWith('town.')).toBe(true)
  })

  it('excerpts a Song with no intro yet by what is known of it', () => {
    expect(excerptOf(cardOf(plain))).toContain('dorian, 80 bpm')
  })

  it('puts the intro into the structured data as its description', () => {
    const data = JSON.parse(structured(cardOf(plain, 'Listen close.'), 'https://ikurad.io/s/1234/x'))
    expect(data.description).toBe('Listen close.')
    expect(JSON.parse(structured(cardOf(plain), 'https://ikurad.io/s/1234/x')).description).toBeUndefined()
  })
})

describe('the first line of text a crawler reads', () => {
  const about = '<body><p id="about" class="visually-hidden">A lost receiver.</p><div id="controls" data-nosnippet></div></body>'

  it('is said as the words asked, escaped, and nothing else is touched', () => {
    expect(aboutOf(about, 'Listen, <b>the night</b> & "snow".')).toBe(
      '<body><p id="about" class="visually-hidden">Listen, &lt;b&gt;the night&lt;/b&gt; &amp; &quot;snow&quot;.</p><div id="controls" data-nosnippet></div></body>',
    )
  })

  it('is left alone if the page has none, and a $ in the words is only a $', () => {
    expect(aboutOf('<body></body>', 'x')).toBe('<body></body>')
    expect(aboutOf(about, 'costs $& and $1')).toContain('costs $&amp; and $1')
  })
})
