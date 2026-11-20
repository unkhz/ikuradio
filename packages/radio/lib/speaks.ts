// A Song's page says what it is (plan "A Song's page says what it is"). The
// Radio writes into /s/<n>/<slug> what the knob's panel would show once the
// Song plays: its name, its weather, key, choir, band, how it is heard, its
// length, and what the mind thought of it. Above the play button, in smaller
// print, it offers the Song by its number and its name. It adds a little
// structured data for anyone reading the page as a machine. Nothing it writes
// links to the Song's sound. Only a Song that has aired is told about:
// nothing from the future.

import type { Session } from 'archive'

/** What a Song's page tells of it: the little of its Session the panel shows, kept instead of the Session, which is large. */
export type Card = {
  song: string
  /** The name the mind gave it, punctuation and all: the first line of the panel, and the page's title. */
  name?: string
  mood: string[]
  mode: string
  tempo: number
  choir: string
  sound?: string
  perspectives: { title: string; variant?: string }[]
  thought?: string
  seconds: number
  /** Its iterations, first and last, as the page counts them. */
  iterations?: { first: string; last: string }
  /** What Rezzy says to introduce it, once an intro has been made: the Song's excerpt wherever it is quoted. */
  intro?: string
}

/** A Session's card, with the words of its intro if it has one. */
export function cardOf(session: Session, intro?: string): Card {
  const first = session.iterations?.[0]
  const last = session.iterations?.at(-1)
  return {
    song: session.song,
    ...(session.name ? { name: session.name } : {}),
    mood: session.mood ?? [],
    mode: session.mode,
    tempo: session.tempo,
    choir: session.choir,
    ...(session.sound ? { sound: session.sound } : {}),
    perspectives: (session.perspectives ?? []).map(({ title, variant }) => ({ title, ...(variant ? { variant } : {}) })),
    ...(session.thought ? { thought: session.thought } : {}),
    seconds: session.seconds,
    ...(first && last ? { iterations: { first: first.iteration, last: last.iteration } } : {}),
    ...(intro?.trim() ? { intro: intro.trim() } : {}),
  }
}

export const escaped = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * What a Song is titled by, wherever a crawler or a card quotes it: its name and its weather, the line
 * that tells what it is, and the radio last.
 */
export function headlineOf(card: Card, site: string): string {
  const name = card.name ?? `Song ${number(card.song)}`
  const weather = card.mood.join(' + ')
  return [name, ...(weather ? [weather] : []), site].join(' · ')
}

/** The most a description is, in characters: more is cut by whoever quotes it. */
const mostExcerpt = 300

/**
 * What a Song is excerpted by: the words Rezzy says to introduce it, whole sentences of them, and,
 * for a Song that has no intro yet, what is known of it.
 */
export function excerptOf(card: Card): string {
  if (!card.intro) {
    return `${card.mood.join(' + ')}: ${card.mode}, ${card.tempo} bpm, sung by ${card.choir}. ${Math.round(card.seconds / 60)} minutes, received from far away.`
  }
  const intro = card.intro.replace(/\s+/g, ' ')
  if (intro.length <= mostExcerpt) return intro
  // cut where a sentence ends, or, if none ends in time, at a word
  const cut = intro.slice(0, mostExcerpt)
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return sentence > 80 ? cut.slice(0, sentence + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

/** A number as the page writes it. */
const number = (n: string) => BigInt(n).toLocaleString('en')

/** How long a Song is, for a person. */
const minutes = (seconds: number) => {
  const m = Math.max(1, Math.round(seconds / 60))
  return `${m} minute${m === 1 ? '' : 's'}`
}

/** The panel's rows, as the page's tellDetails() writes them: a name and what it says. */
export function rowsOf(card: Card): [string, string][] {
  const { iterations } = card
  return [
    ...(card.name ? [['name', card.name] as [string, string]] : []),
    ['song', number(card.song)],
    ['weather', card.mood.join(' + ')],
    ['key', `${card.mode}, ${card.tempo} bpm`],
    ['choir', card.choir],
    ...(card.sound ? [['band', card.sound] as [string, string]] : []),
    ...(card.perspectives.length
      ? [['heard', card.perspectives.map(({ title, variant }) => (variant ? `${title}: ${variant}` : title)).join(', ')] as [string, string]]
      : []),
    [
      'length',
      minutes(card.seconds) +
        (iterations
          ? iterations.first === iterations.last
            ? `, iteration ${number(iterations.first)}`
            : `, iterations ${number(iterations.first)} to ${number(iterations.last)}`
          : ''),
    ],
  ]
}

/** An ISO 8601 duration, as schema.org reads one. */
const duration = (seconds: number) => {
  const s = Math.round(seconds)
  return `PT${Math.floor(s / 60)}M${s % 60}S`
}

/** The Song as structured data, schema.org's MusicRecording, safe inside a script element. */
export function structured(card: Card, url: string): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: card.name ?? `Song ${number(card.song)}`,
    url,
    duration: duration(card.seconds),
    keywords: card.mood.join(', '),
    ...(card.intro ? { description: excerptOf(card) } : {}),
    inLanguage: 'en',
    byArtist: { '@type': 'MusicGroup', name: 'ikuradio' },
  }
  // nothing in it can close the script, or open a comment
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

/** What the page says of the Song it offers, above the play button: its number, and its name when it has one. */
const offeredOf = (card: Card) => `Song ${number(card.song)}${card.name ? ` · ${card.name}` : ''}`

/**
 * The page, telling what it knows of a Song that has aired: the number and
 * name offered above the play button, the panel's rows, marked as served so
 * the page keeps them until it plays, the mind's thought, and the structured
 * data beside the social tags. A Song not yet aired, `undefined`, is told
 * nothing, and the page is as it was.
 */
export function speak(page: string, card: Card | undefined, url: string): string {
  if (!card) return page
  const rows = rowsOf(card)
    .map(([name, value]) => `<dt>${escaped(name)}</dt><dd>${escaped(value)}</dd>`)
    .join('')
  // replaced by functions, so that a `$` in a Song's words is only a `$`
  let told = page
    .replace('<p id="offered" hidden></p>', () => `<p id="offered" data-served>${escaped(offeredOf(card))}</p>`)
    .replace('<dl id="details"></dl>', () => `<dl id="details" data-served>${rows}</dl>`)
  if (card.thought) {
    told = told.replace(
      /<figure id="thought" hidden>([\s\S]*?)<p><\/p>/,
      (_, between: string) => `<figure id="thought">${between}<p>${escaped(card.thought!)}</p>`,
    )
  }
  return told.replace('</head>', () => `  <script type="application/ld+json">${structured(card, url)}</script>\n  </head>`)
}
