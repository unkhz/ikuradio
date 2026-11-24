// A Song's page says what it is (plan "A Song's page says what it is"). The
// Radio writes into /s/<n>/<slug> what the knob's panel would show once the
// Song plays: its name, its weather, key, choir, band, how it is heard, its
// length, and what the mind thought of it. Above the play button, in smaller
// print, it offers the Song by its number and its name. It adds a little
// structured data for anyone reading the page as a machine. Nothing it writes
// links to the Song's sound. Only a Song that has aired is told about:
// nothing from the future.

import type { Session } from 'archive'

/** One part of a Song, as the structure drilldown shows it: its kind, length, and any own pace or mode. */
export type CardPart = {
  type: string
  seconds: number
  tempo?: number | null
  mode?: string
  lines: number
  iteration: number
}

/** What a Song's page tells of it: the little of its Session the panel shows, kept instead of the Session, which is large. */
export type Card = {
  song: string
  /** The Arrangement the Song was made as, by its human title (older Songs before Arrangements were recorded used `The Song as it always was`). */
  arrangement: string
  /** The name the mind gave it, punctuation and all: the first line of the panel, and the page's title. */
  name?: string
  mood: string[]
  mode: string
  tempo: number
  choir: string
  sound?: string
  tracks?: string[]
  perspectives: { title: string; variant?: string }[]
  thought?: string
  seconds: number
  /** Its iterations, first and last, as the page counts them. */
  iterations?: { first: string; last: string; count: number }
  /** Its parts in order, for the compact SSR structure drilldown. */
  parts?: CardPart[]
  /** What Rezzy says to introduce it, once an intro has been made: the Song's excerpt wherever it is quoted. */
  intro?: string
}

/** The human title of an Arrangement from its Session: explicit title, legacy default, or humanized slug. */
export function arrangementName(slug?: string, title?: string): string {
  if (title?.trim()) return title.trim()
  if (!slug || slug === 'the-song') return 'The Song as it always was'
  return slug
    .split('-')
    .map((word) => (word ? `${word[0]!.toUpperCase()}${word.slice(1)}` : word))
    .join(' ')
}

/** A Session's card, with the words of its intro if it has one. */
export function cardOf(session: Session, intro?: string): Card {
  const first = session.iterations?.[0]
  const last = session.iterations?.at(-1)
  const parts: CardPart[] = (session.iterations ?? []).flatMap((it, index) =>
    (it.parts ?? []).map((part) => ({
      type: part.type,
      seconds: Math.round(part.seconds),
      ...(part.tempo !== undefined ? { tempo: part.tempo } : {}),
      ...(part.mode ? { mode: part.mode } : {}),
      lines: part.lines?.length ?? 0,
      iteration: index + 1,
    })),
  )
  return {
    song: session.song,
    arrangement: arrangementName(session.arrangement, session.arrangementTitle),
    ...(session.name ? { name: session.name } : {}),
    mood: session.mood ?? [],
    mode: session.mode,
    tempo: session.tempo,
    choir: session.choir ?? '',
    ...(session.sound ? { sound: session.sound } : {}),
    ...(session.tracks?.length ? { tracks: session.tracks } : {}),
    perspectives: (session.perspectives ?? []).map(({ title, variant }) => ({ title, ...(variant ? { variant } : {}) })),
    ...(session.thought ? { thought: session.thought } : {}),
    seconds: session.seconds,
    ...(first && last ? { iterations: { first: first.iteration, last: last.iteration, count: session.iterations.length } } : {}),
    ...(parts.length ? { parts } : {}),
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

/** How the Song moves in time across its parts: one tempo, a range, and/or free time. */
export function paceOf(card: Pick<Card, 'tempo' | 'parts'>): string {
  const tempi = card.parts?.length ? card.parts.map((part) => (part.tempo !== undefined ? part.tempo : card.tempo)) : [card.tempo]
  const numbers = [...new Set(tempi.filter((t): t is number => typeof t === 'number' && Number.isFinite(t)))].sort((a, b) => a - b)
  const free = tempi.includes(null)
  const pieces: string[] = []
  if (numbers.length === 1) pieces.push(`${numbers[0]} bpm`)
  else if (numbers.length > 1) pieces.push(`${numbers[0]}–${numbers.at(-1)} bpm`)
  if (free) pieces.push('free time')
  return pieces.join(', ') || `${card.tempo} bpm`
}

/** Whether a Song's parts vary in tempo from the Song's base. */
const variesTempo = (card: Pick<Card, 'tempo' | 'parts'>) =>
  (card.parts ?? []).some((part) => part.tempo !== undefined && part.tempo !== card.tempo)

/**
 * What a Song is excerpted by: the words Rezzy says to introduce it, whole sentences of them, and,
 * for a Song that has no intro yet, what is known of it.
 */
export function excerptOf(card: Card): string {
  if (!card.intro) {
    const mood = card.mood.join(' + ')
    const key = [card.mode, paceOf(card)].filter(Boolean).join(', ')
    const voiced = card.choir ? `, sung by ${card.choir}` : ''
    return `${mood ? `${mood}: ` : ''}${key}${voiced}. ${Math.round(card.seconds / 60)} minutes, received from far away.`
  }
  const intro = card.intro.replace(/\s+/g, ' ')
  if (intro.length <= mostExcerpt) return intro
  // cut where a sentence ends, or, if none ends in time, at a word
  const cut = intro.slice(0, mostExcerpt)
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return sentence > 80 ? cut.slice(0, sentence + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

/**
 * The page's first line of text, which a crawler reads first and a search quotes, said as `words`: a
 * Song's excerpt on a Song's page, the radio's own tagline everywhere else. It is not drawn.
 */
export const aboutOf = (page: string, words: string): string =>
  page.replace(/(<p id="about"[^>]*>)[^<]*(<\/p>)/, (_, open: string, close: string) => `${open}${escaped(words)}${close}`)

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
  const key = [card.mode, paceOf(card)].filter(Boolean).join(', ')
  return [
    ...(card.name ? [['name', card.name] as [string, string]] : []),
    ['song', number(card.song)],
    ['arrangement', card.arrangement],
    ...(card.mood.length ? [['weather', card.mood.join(' + ')] as [string, string]] : []),
    ...(key ? [['key', key] as [string, string]] : []),
    ...(card.choir ? [['choir', card.choir] as [string, string]] : []),
    ...(card.sound ? [['band', card.sound] as [string, string]] : []),
    ...(card.tracks?.length ? [['tracks', card.tracks.join(', ')] as [string, string]] : []),
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

/** The collapsible structure drilldown: summary label and per-part rows, SSR'd for crawlers while keeping the panel compact. */
export function partsOf(card: Card): { summary: string; items: { label: string; meta: string }[] } | undefined {
  const parts = card.parts
  if (!parts?.length) return undefined
  const passes = card.iterations?.count ?? new Set(parts.map((p) => p.iteration)).size
  const summary =
    passes > 1
      ? `structure · ${passes} iterations, ${parts.length} parts`
      : `structure · ${parts.length} part${parts.length === 1 ? '' : 's'}`
  const showPace = variesTempo(card)
  const items = parts.map((part) => {
    const tempo = part.tempo !== undefined ? part.tempo : card.tempo
    const pace = tempo === null ? 'free time' : `${tempo} bpm`
    const meta = [
      `${Math.max(1, Math.round(part.seconds))}s`,
      ...(showPace ? [pace] : []),
      ...(part.mode && part.mode !== card.mode ? [part.mode] : []),
      ...(part.lines > 0 ? [`${part.lines} line${part.lines === 1 ? '' : 's'}`] : []),
    ].join(' · ')
    return { label: part.type, meta }
  })
  return { summary, items }
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
  const structure = partsOf(card)
  if (structure) {
    const list = structure.items
      .map(({ label, meta }) => `<li><span class="part-type">${escaped(label)}</span><span class="part-meta">${escaped(meta)}</span></li>`)
      .join('')
    told = told.replace(
      /<details id="parts" hidden>[\s\S]*?<\/details>/,
      () => `<details id="parts" data-served><summary>${escaped(structure.summary)}</summary><ol>${list}</ol></details>`,
    )
  }
  if (card.thought) {
    told = told.replace(
      /<figure id="thought" hidden>([\s\S]*?)<p><\/p>/,
      (_, between: string) => `<figure id="thought">${between}<p>${escaped(card.thought!)}</p>`,
    )
  }
  return told.replace('</head>', () => `  <script type="application/ld+json">${structured(card, url)}</script>\n  </head>`)
}
