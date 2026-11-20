// What a capture is asked for, read from the command line.

export type Size = { width: number; height: number }

/** `1080x1920` as a size; anything else is an error. */
export function sizeOf(text: string): Size {
  const found = /^([1-9]\d{2,4})x([1-9]\d{2,4})$/.exec(text)
  if (!found) throw new Error(`a size is written like 1080x1920, not "${text}"`)
  return { width: Number(found[1]), height: Number(found[2]) }
}

/** The address to capture: a Song's own, with `?promo=<seconds>` when it is a promo. Without it, the whole Song. */
export function addressOf(url: string, promo?: number): string {
  const address = new URL(url)
  if (!/^\/s\/[1-9]\d*\/[^/]+$/.test(address.pathname)) throw new Error(`${url} is not a Song's own address: /s/<number>/<name>`)
  address.searchParams.delete('promo')
  if (promo !== undefined) {
    if (!Number.isFinite(promo) || promo < 20) throw new Error('a promo is at least 20 seconds')
    address.searchParams.set('promo', String(promo))
  }
  return address.href
}

/** The file a capture is kept in, by default: the Song's number and what was captured of it. */
export function nameOf(url: string, promo?: number): string {
  const [, number] = /^\/s\/(\d+)\//.exec(new URL(url).pathname) ?? []
  return `song-${number}-${promo === undefined ? 'whole' : `promo-${promo}s`}.mp4`
}

/**
 * ffmpeg's arguments to cut the raw capture from `from` seconds and keep it as a video any
 * service takes, exactly `size` pixels: the browser's tab is a few pixels short of its window.
 */
export function cutArgs(raw: string, from: number, out: string, size: Size): string[] {
  return [
    '-y',
    '-loglevel', 'error',
    '-i', raw,
    '-ss', from.toFixed(3),
    '-vf', `scale=${size.width}:${size.height}:flags=lanczos`,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    out,
  ]
}
