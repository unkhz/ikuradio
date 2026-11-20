// Texts about a Song, for posting where it is shown: what its Archive says of it.

import { slugOf, type DjDeclaration, type Session } from 'archive'
import { verseAsked } from 'song'
import type { Present } from './present.js'

/** What a Song's texts are made of: its Session, what Rezzy said if they did, and where the Radio is. */
export type Song = { session: Session; dj?: DjDeclaration; radio: string }

export const assets = ['intro', 'name', 'slug', 'url', 'lyrics', 'meta', 'thoughts', 'tweet', 'prompt'] as const
export type Asset = (typeof assets)[number]

/** The Song's words as the page shows them: a line at a time, each once, in the order they are first sung. */
export function linesOf(session: Session): string[] {
  const seen = new Set<string>()
  return session.iterations
    .flatMap(({ parts }) => parts.flatMap(({ lines }) => lines.map(({ text }) => text.trim())))
    .filter((line) => line && !seen.has(line) && !!seen.add(line))
}

const named = ({ session }: Song) => {
  if (!session.name) throw new Error(`Song ${session.song} has no name`)
  return session.name
}

/** The address the Song is heard at. */
export const urlOf = (song: Song): string => `${song.radio.replace(/\/$/, '')}/s/${song.session.song}/${encodeURIComponent(slugOf(named(song)))}`

/** What Rezzy said to introduce the Song. */
export function introOf({ dj, session }: Song): string {
  const text = dj?.parts.intro?.speech.text
  if (!text) throw new Error(`Song ${session.song} has no intro said yet`)
  return text
}

/** What is known of the Song, a thing to a line. */
export function metaOf({ session }: Song): string {
  return [
    `name: ${session.name ?? `Song ${session.song}`}`,
    `weather: ${session.mood.join(' + ')}`,
    `mode: ${session.mode}`,
    `tempo: ${session.tempo} bpm`,
    ...(session.sound ? [`sound: ${session.sound}`] : []),
    ...(session.choir ? [`sung by: ${session.choir}`] : []),
    `length: ${(session.seconds / 60).toFixed(1)} minutes`,
  ].join('\n')
}

/** What the Song's mind thought of it, when it wrote it. */
export function thoughtOf({ session }: Song): string {
  if (!session.thought) throw new Error(`Song ${session.song} kept no thought`)
  return session.thought
}

/**
 * The prompt the mind could be given for a verse of this Song, to ask another mind (a chat) for the next
 * one: its instruction, in the Song's weather, with what the mind would have in it at the moment given as
 * `present` (see ./present.ts), then its input, the verse before. `verse` (1-based) is the verse that is
 * the input; the last one by default. With no `present` the mind has only the Song's own thought, which is
 * all the Archive keeps of the time the Song was written.
 */
export function promptOf({ session }: Song, verse?: number, present?: Present): string {
  const lines = linesOf(session)
  const verses = Array.from({ length: Math.floor(lines.length / 4) }, (_, i) => lines.slice(i * 4, i * 4 + 4))
  const chosen = verse === undefined ? verses.at(-1) : verses[verse - 1]
  if (!chosen) throw new Error(`Song ${session.song} has no verse ${verse ?? ''} to ask after`)
  const instruction = verseAsked(session.mood, present ?? { memories: { own: session.thought ? [session.thought] : [], heard: [] } })
  return `${instruction}\nThe song is called "${session.name ?? `Song ${session.song}`}".\n\nInput:\n${chosen.join('\n')}`
}

/** Who said it: the DJ of the Song's declaration, as a name. */
const signedBy = ({ dj }: Song): string => {
  const name = dj?.dj ?? ''
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** The introduction, signed by the DJ who said it, and the address, as a post. */
export const tweetOf = (song: Song): string => `${introOf(song)}\n— ${signedBy(song)}\n\n${urlOf(song)}`

/** The asset asked for, as text. */
export function print(song: Song, asset: Asset, { verse, present }: { verse?: number; present?: Present } = {}): string {
  switch (asset) {
    case 'intro':
      return introOf(song)
    case 'name':
      return named(song)
    case 'slug':
      return slugOf(named(song))
    case 'url':
      return urlOf(song)
    case 'lyrics':
      return linesOf(song.session).join('\n')
    case 'meta':
      return metaOf(song)
    case 'thoughts':
      return thoughtOf(song)
    case 'tweet':
      return tweetOf(song)
    case 'prompt':
      return promptOf(song, verse, present)
  }
}
