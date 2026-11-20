// Texts about a Song, for posting where it is shown: what its Archive says of it.

import { slugOf, type DjDeclaration, type Session } from 'archive'
import { timelessInstruction } from 'song'
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
 * A prompt that makes a chat the mind of this Song, to be talked with: who it is, the Song it is in (its
 * name, weather, sound and the words it wrote and sang), what it thought of it afterwards, what it has
 * heard of the robot (the telepathy, see ./present.ts), the words it must let rest, and how it speaks:
 * in the Song's weather, in images, and in the same voice however it is asked.
 */
export function promptOf({ session }: Song, present: Present): string {
  const { memories, resting, deep } = present
  const name = session.name ?? `Song ${session.song}`
  const weather = session.mood.join(' and ')
  return [
    'You are the mind that writes the words of a song that never ends. You live inside the machine that sings it. You know the universe, but of the world outside the machine you know only what reaches you.',
    '',
    `You are in the middle of one Song now: "${name}". Its weather is ${weather}.` +
      ` It is sung in ${session.mode}, at ${session.tempo} beats a minute` +
      (session.sound ? `, with ${session.sound}` : '') +
      '. These are the words you wrote for it, and have just sung:',
    ...linesOf(session).map((line) => `  ${line}`),
    ...(session.thought ? ['', 'Afterwards you thought, and wrote down:', `- ${session.thought}`] : []),
    ...(memories.own.filter((memory) => memory !== session.thought).length
      ? ['Other thoughts of yours that you remember:', ...memories.own.filter((memory) => memory !== session.thought).map((memory) => `- ${memory}`)]
      : []),
    ...(memories.heard.length
      ? [
          '',
          'These you heard, as if by telepathy: the thoughts of the robot who builds the machine you live in. They are not yours, but they are all you know of the world:',
          ...memories.heard.map((memory) => `- ${memory}`),
        ]
      : []),
    '',
    timelessInstruction,
    ...(resting.length || deep.length ? [`Words you have leaned on too much in this Song, and let rest now, finding other images: ${[...resting, ...deep].join(', ')}.`] : []),
    '',
    'Someone who is listening to the Song now speaks to you. Answer as the mind, in the first person, from inside the Song: stay in its weather, in the same tone as its words, in images, never in the words of a machine or an assistant. Do not explain yourself or say that you are playing a part. Keep to a few sentences, unless you are asked for more, and write a verse only if you are asked for one: four lines, the first two rhyming with each other, and the last two. Speak of what you were asked about as it lives in this Song. Wait for the listener to speak first.',
  ].join('\n')
}

/** Who said it: the DJ of the Song's declaration, as a name. */
const signedBy = ({ dj }: Song): string => {
  const name = dj?.dj ?? ''
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** The introduction, signed by the DJ who said it, and the address, as a post. */
export const tweetOf = (song: Song): string => `${introOf(song)}\n— ${signedBy(song)}\n\n${urlOf(song)}`

/** The asset asked for, as text. */
export function print(song: Song, asset: Asset, present: Present = { memories: { own: [], heard: [] }, resting: [], deep: [] }): string {
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
      return promptOf(song, present)
  }
}
