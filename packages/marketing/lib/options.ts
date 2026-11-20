// What a capture is asked for, read from the command line.

import { resolve } from 'node:path'

export type Size = { width: number; height: number }

/** `1080x1920` as a size; anything else is an error. */
export function sizeOf(text: string): Size {
  const found = /^([1-9]\d{2,4})x([1-9]\d{2,4})$/.exec(text)
  if (!found) throw new Error(`a size is written like 1080x1920, not "${text}"`)
  return { width: Number(found[1]), height: Number(found[2]) }
}

/**
 * The address to capture: a Song's own, with `?promo=<seconds>` for a promo and `?promo=0` for
 * the whole Song as it is (a page that does not ask the Radio again, and rests when it has ended),
 * and `?intro=0` when its intro is to be left out.
 */
export function addressOf(url: string, promo = 0, { intro = true }: { intro?: boolean } = {}): string {
  const address = new URL(url)
  if (!/^\/s\/[1-9]\d*\/[^/]+$/.test(address.pathname)) throw new Error(`${url} is not a Song's own address: /s/<number>/<name>`)
  address.searchParams.delete('promo')
  address.searchParams.delete('intro')
  if (promo !== 0 && (!Number.isFinite(promo) || promo < 20)) throw new Error('a promo is at least 20 seconds, or 0 for the whole Song')
  address.searchParams.set('promo', String(promo))
  if (!intro) address.searchParams.set('intro', '0')
  return address.href
}

/** The file a capture is kept in, by default: the Song's number and what was captured of it. */
export function nameOf(url: string, promo?: number, audioOnly = false): string {
  const [, number] = /^\/s\/(\d+)\//.exec(new URL(url).pathname) ?? []
  return `song-${number}-${promo === undefined ? 'whole' : `promo-${promo}s`}.${audioOnly ? 'mp3' : 'mp4'}`
}

/** Seconds of the front page that begin a capture, unless asked for: a video has one, for its still; a sound has none. */
export const coverOf = (asked: string | undefined, audioOnly: boolean): number => (asked === undefined ? (audioOnly ? 0 : 1) : Number(asked))

/** Where a capture is kept: `file` if given, else its default name in `dir` (or the package's own `out/`), made absolute from `from`. */
export function placeOf({ file, dir, name, fallback, from }: { file?: string; dir?: string; name: string; fallback: string; from: string }): string {
  if (file) return resolve(from, file)
  return resolve(from, dir ?? fallback, name)
}

/** What is kept in a capture besides its picture and sound. */
export type Keeping = {
  /** An image kept in the file as its thumbnail: what a player or a service shows before it plays. */
  thumbnail?: string
  /** The Song's name, and where it is heard. */
  title?: string
  comment?: string
}

/**
 * ffmpeg's arguments to cut the raw capture from `from` seconds and keep it as a video any
 * service takes, exactly `size` pixels: the browser's tab is a few pixels short of its window.
 * The thumbnail is put in the file as its attached picture, and the Song's name and address as
 * its title and comment.
 */
export function cutArgs(raw: string, from: number, out: string, size: Size, audioOnly = false, keeping: Keeping = {}): string[] {
  const { thumbnail, title, comment } = keeping
  // the cut is of the input, so that the thumbnail, which has only a moment 0, is not cut with it
  const inputs = ['-y', '-loglevel', 'error', '-ss', from.toFixed(3), '-i', raw, ...(thumbnail ? ['-i', thumbnail] : [])]
  const marks = [...(title ? ['-metadata', `title=${title}`, '-metadata', 'artist=ikuradio'] : []), ...(comment ? ['-metadata', `comment=${comment}`] : [])]
  // for posting where there is only sound to post: a sound at the best an mp3 is, as it was made
  if (audioOnly) {
    return [
      ...inputs,
      '-map', '0:a',
      ...(thumbnail ? ['-map', '1:v', '-c:v', 'mjpeg', '-id3v2_version', '3', '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)'] : []),
      '-c:a', 'libmp3lame',
      '-b:a', '320k',
      ...marks,
      out,
    ]
  }
  return [
    ...inputs,
    '-map', '0:v',
    '-map', '0:a',
    ...(thumbnail ? ['-map', '1:v'] : []),
    '-filter:v:0', `scale=${size.width}:${size.height}:flags=lanczos`,
    '-c:v:0', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    ...(thumbnail ? ['-c:v:1', 'mjpeg', '-disposition:v:1', 'attached_pic'] : []),
    '-c:a', 'aac',
    '-b:a', '192k',
    ...marks,
    '-movflags', '+faststart',
    out,
  ]
}
