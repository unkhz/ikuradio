import { describe, expect, it } from 'bun:test'
import type { Session } from 'archive'
import { cardOf, rowsOf, speak, structured } from './speaks.js'

const page = `<html><head>
    <title>ikuradio</title>
  </head><body>
      <dl id="details"></dl>
      <figure id="thought" hidden>
        <figcaption>the mind</figcaption>
        <p></p>
      </figure>
</body></html>`

/** A Session whose words need escaping, everywhere they can. */
const session = {
  song: '1234',
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

const url = 'https://ikurad.io/s/1234'

describe('a Song page that speaks', () => {
  const told = speak(page, cardOf(session), url)

  it('serves the panel rows as the page writes them, marked as served, everything escaped', () => {
    const details = /<dl id="details" data-served>([\s\S]*?)<\/dl>/.exec(told)![1]!
    expect(details).toContain('<dt>song</dt><dd>1,234</dd>')
    expect(details).toContain('<dt>weather</dt><dd>&lt;script&gt;alert(&quot;rain&quot;)&lt;/script&gt; + gears &amp; cogs</dd>')
    expect(details).toContain('<dt>key</dt><dd>dorian, 80 bpm</dd>')
    expect(details).toContain('<dt>choir</dt><dd>a woman&#39;s voice, with a &quot;child&quot;</dd>')
    expect(details).toContain('<dt>band</dt><dd>oud &lt;/script&gt;&lt;!-- &amp; $&amp; darbuka</dd>')
    expect(details).toContain('<dt>heard</dt><dd>A chorus coming home, Walking verses: ii-V-I</dd>')
    expect(details).toContain('<dt>length</dt><dd>8 minutes, iterations 1,000 to 1,001</dd>')
    expect(details).not.toContain('<script>')
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
      name: 'Song 1,234',
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
    const plain = cardOf({ ...session, sound: undefined, perspectives: undefined, thought: undefined, iterations: [{ iteration: '7' }] } as unknown as Session)
    expect(rowsOf(plain).map(([name]) => name)).toEqual(['song', 'weather', 'key', 'choir', 'length'])
    expect(rowsOf(plain).at(-1)![1]).toBe('8 minutes, iteration 7')
    const told = speak(page, plain, url)
    expect(told).toContain('<figure id="thought" hidden>')
    expect(structured(plain, url)).toContain('"duration":"PT8M12S"')
  })
})
