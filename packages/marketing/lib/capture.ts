// A capture: a Song filmed as its page shows it, with its sound, from the moment
// the front page goes until the page says what is filmed is over.
//
// The page is opened and left to download; when it says it is ready, the tab is
// filmed from inside it, and play is clicked. The page says `started` when the
// front page has gone and `finished` when the promo ends or, for a whole Song,
// when the Song has, just before it shows what comes after (see `announce` in
// packages/ui/public/index.js). The capture is cut at the first, ended at the second.

import { spawn } from 'node:child_process'
import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { chromium } from 'playwright-core'
import { cutArgs, textOf, type Keeping, type Size } from './options.js'
import { tagSrgb } from './png.js'

/** A script that puts a style on a page as it is made, before it is laid out. */
const styling = (css: string) =>
  `if (${JSON.stringify(css)}) { const style = document.createElement('style'); style.textContent = ${JSON.stringify(css)}; document.documentElement.appendChild(style) }`

export type Capture = {
  address: string
  out: string
  size: Size
  /** Pixels to a point: 2 films a 540x960 page as 1080x1920. */
  scale: number
  /** Seconds to go on after the page says it is over, so its last moment is seen. */
  hold: number
  /** Seconds of the front page, logo and name, that begin the video, so a platform's still of it is the receiver. */
  cover: number
  /** An image to keep in the file as its thumbnail, in place of a picture of the front page. */
  thumbnail?: string
  /** Pixels along a side of the cover a sound has, if it is not given a thumbnail: 4000. */
  artSize?: number
  /** Only its sound is kept: an mp3. */
  audioOnly?: boolean
  /** Chrome without a window on screen: it captures its own tab, and needs no permission to watch the screen. */
  headless?: boolean
  /** Seconds to wait for the page to download, and, after it is played, for it to finish, at the most. */
  patience: { ready: number; finish: number }
}

export async function capture({ address, out, size, scale, hold, cover, patience, headless = true, audioOnly = false, thumbnail, artSize = 4000 }: Capture): Promise<void> {
  await mkdir(dirname(out), { recursive: true })
  const raw = `${out}.raw.webm`
  await writeFile(raw, '')
  // Chrome, as the person has it: its sound and its codecs are what the page is made for
  const browser = await chromium.launch({
    channel: 'chrome',
    headless,
    // Playwright mutes a Chrome without a window, and a muted tab has no sound to capture
    ignoreDefaultArgs: ['--mute-audio'],
    args: ['--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'],
  })
  try {
    // --screen is the pixels of the video; --scale makes the page that many times larger in it, so the page is laid out
    // as on a screen of size / scale (a phone's 540x960 at 2 is 1080x1920 pixels) and its text is as large as there
    const viewport = { width: Math.round(size.width / scale), height: Math.round(size.height / scale) }
    const context = await browser.newContext({ viewport, deviceScaleFactor: scale })
    await context.addInitScript(styling(textOf(size, scale)))
    const page = await context.newPage()
    page.on('pageerror', (error) => console.warn(`the page: ${error.message}`))
    await page.exposeFunction('capturedPiece', (piece: string) => appendFile(raw, Buffer.from(piece, 'base64')))
    let over!: (from: number) => void
    const finished = new Promise<number>((resolve) => (over = resolve))
    await page.exposeFunction('captureIsOver', (from: number) => over(from))

    console.log(`opening ${address}`)
    await page.goto(address)
    // the page says when its downloads are done; the network is never quiet for long, it asks the Radio
    await page.waitForSelector('body[data-ready="yes"]', { timeout: patience.ready * 1000, state: 'attached' })
    console.log('the Song is downloaded and ready')

    // a click, so that the browser lets the page be filmed; the front page does not mind one
    await page.mouse.click(1, 1)
    await page.evaluate(
      async ({ hold, audioOnly }) => {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          // the browser asks for a picture too; a sound alone takes a little of one and keeps none
          video: { frameRate: audioOnly ? 1 : 30 },
          // the tab's sound as it is: both channels, not tidied for a call
          audio: { channelCount: 2, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          preferCurrentTab: true,
          selfBrowserSurface: 'include',
        } as DisplayMediaStreamOptions)
        const recorder = audioOnly
          ? new MediaRecorder(new MediaStream(stream.getAudioTracks()), { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256_000 })
          : new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 12_000_000 })
        const pieces: Promise<void>[] = []
        recorder.ondataavailable = ({ data }) => {
          pieces.push(
            data.arrayBuffer().then((buffer) => {
              let text = ''
              const bytes = new Uint8Array(buffer)
              for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
              return (window as any).capturedPiece(btoa(text))
            }),
          )
        }
        const began = performance.now()
        let from = 0
        recorder.start(1000)
        addEventListener('ikuradio:started', () => (from = (performance.now() - began) / 1000), { once: true })
        addEventListener(
          'ikuradio:finished',
          () =>
            setTimeout(() => {
              recorder.onstop = () => Promise.all(pieces).then(() => (window as any).captureIsOver(from))
              recorder.stop()
              stream.getTracks().forEach((track) => track.stop())
            }, hold * 1000),
          { once: true },
        )
      },
      { hold, audioOnly },
    )
    console.log('filming the page; playing the Song')
    // the front page without its button: the video's first seconds
    const withoutButton = await page.addStyleTag({ content: '#tune { opacity: 0 }' })
    // and the thumbnail kept in the file: the Song's own front page, held still at its moment 0, so that
    // the same Song always has the same one. A sound's cover is a square of its own, 8 bits of red, green
    // and blue to a pixel, said to be sRGB, and drawn at that size, not a picture made larger
    const still = thumbnail ?? `${out}.thumbnail.png`
    if (!thumbnail) {
      const side = 800
      const look = audioOnly ? { viewport: { width: side, height: side }, deviceScaleFactor: artSize / side } : { viewport, deviceScaleFactor: scale }
      const artContext = await browser.newContext(look)
      if (!audioOnly) await artContext.addInitScript(styling(textOf(size, scale)))
      const art = await artContext.newPage()
      const frontPage = new URL(address)
      frontPage.search = '?time=0'
      await art.goto(frontPage.href)
      await art.addStyleTag({ content: '#tune { opacity: 0 }' })
      await art.waitForTimeout(2500)
      await writeFile(still, tagSrgb(await art.screenshot({ type: 'png' })))
      await art.context().close()
    }
    if (cover > 0) await page.waitForTimeout(cover * 1000)
    else await withoutButton.evaluate((style) => (style as HTMLElement).remove())
    await page.click('#play')

    // the wait is given up on after `patience.finish`; the timer is cleared when it is no longer
    // wanted, or it would keep the process alive for as long as it had left
    let giveUp: ReturnType<typeof setTimeout> | undefined
    const from = await Promise.race([
      finished,
      new Promise<never>((_, reject) => (giveUp = setTimeout(() => reject(new Error(`the page did not finish in ${patience.finish}s`)), patience.finish * 1000))),
    ]).finally(() => clearTimeout(giveUp))
    const keeping: Keeping = { thumbnail: still, title: (await page.title()).replace(/ · ikuradio$/, ''), comment: address.replace(/\?.*$/, '') }
    const start = Math.max(0, from - cover)
    console.log(`finished; cutting from ${start.toFixed(2)}s`)
    await browser.close()
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', cutArgs(raw, start, out, size, audioOnly, keeping), { stdio: ['ignore', 'ignore', 'inherit'] })
      ffmpeg.on('error', reject)
      ffmpeg.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg stopped with ${code}`))))
    })
    console.log(`kept as ${out}`)
  } finally {
    await browser.close().catch(() => {})
    await rm(raw, { force: true })
    if (!thumbnail) await rm(`${out}.thumbnail.png`, { force: true })
  }
}
