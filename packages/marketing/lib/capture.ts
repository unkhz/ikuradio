// A capture: a Song filmed as its page shows it, with its sound, from the moment
// the front page goes until the page says what is filmed is over.
//
// The page is opened and left to download; when it says it is ready, the tab is
// recorded from inside it, and play is clicked. The page says `started` when the
// front page has gone and `finished` when the promo ends or, for a whole Song,
// when the Song has, just before it shows what comes after (see `announce` in
// packages/ui/public/index.js). The recording is cut at the first, ended at the second.

import { spawn } from 'node:child_process'
import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { chromium } from 'playwright-core'
import { cutArgs, type Size } from './options.js'

export type Capture = {
  address: string
  out: string
  size: Size
  /** Pixels to a point: 2 films a 540x960 page as 1080x1920. */
  scale: number
  /** Seconds to go on after the page says it is over, so its last moment is seen. */
  hold: number
  /** Seconds to wait for the page to download, and, after it is played, for it to finish, at the most. */
  patience: { ready: number; finish: number }
}

export async function capture({ address, out, size, scale, hold, patience }: Capture): Promise<void> {
  await mkdir(dirname(out), { recursive: true })
  const raw = `${out}.raw.webm`
  await writeFile(raw, '')
  // Chrome, as the person has it: its sound and its codecs are what the page is made for
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'],
  })
  try {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: scale })
    const page = await context.newPage()
    page.on('pageerror', (error) => console.warn(`the page: ${error.message}`))
    await page.exposeFunction('capturedPiece', (piece: string) => appendFile(raw, Buffer.from(piece, 'base64')))
    let over!: (from: number) => void
    const finished = new Promise<number>((resolve) => (over = resolve))
    await page.exposeFunction('captureIsOver', (from: number) => over(from))

    console.log(`opening ${address}`)
    await page.goto(address)
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('body[data-ready="yes"]', { timeout: patience.ready * 1000, state: 'attached' })
    console.log('the Song is downloaded and ready')

    // a click, so that the browser lets the page be recorded; the front page does not mind one
    await page.mouse.click(1, 1)
    await page.evaluate(
      async ({ hold }) => {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true,
          preferCurrentTab: true,
          selfBrowserSurface: 'include',
        } as DisplayMediaStreamOptions)
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 12_000_000 })
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
      { hold },
    )
    console.log('recording the page; playing the Song')
    await page.click('#play')

    const from = await Promise.race([
      finished,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`the page did not finish in ${patience.finish}s`)), patience.finish * 1000)),
    ])
    console.log(`finished; cutting from ${from.toFixed(2)}s`)
    await browser.close()
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', cutArgs(raw, from, out, { width: size.width * scale, height: size.height * scale }), { stdio: ['ignore', 'ignore', 'inherit'] })
      ffmpeg.on('error', reject)
      ffmpeg.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg stopped with ${code}`))))
    })
    console.log(`kept as ${out}`)
  } finally {
    await browser.close().catch(() => {})
    await rm(raw, { force: true })
  }
}
