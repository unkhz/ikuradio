// A cover: the front page of a Song, held still at its moment 0, kept as a PNG, so that the same
// Song always has the same one. For where a sound is posted and its cover cannot be read from the
// file (SoundCloud takes an mp3's sound and wants the picture beside it).

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { chromium } from 'playwright-core'
import type { Size } from './options.js'
import { tagSrgb } from './png.js'

export type Cover = {
  /** The Song's own address. */
  address: string
  out: string
  /** The pixels of the picture. */
  size: Size
  /** The page is laid out as on a screen of size / scale, and drawn at size: it is not a picture made larger. */
  scale: number
  /** Style for the page's text, if it is not to be as the page makes it. */
  text?: string
}

export async function cover({ address, out, size, scale, text = '' }: Cover): Promise<void> {
  await mkdir(dirname(out), { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const viewport = { width: Math.round(size.width / scale), height: Math.round(size.height / scale) }
    const context = await browser.newContext({ viewport, deviceScaleFactor: scale })
    if (text) await context.addInitScript(`const style = document.createElement('style'); style.textContent = ${JSON.stringify(text)}; document.documentElement.appendChild(style)`)
    const page = await context.newPage()
    const frontPage = new URL(address)
    frontPage.search = '?time=0'
    await page.goto(frontPage.href)
    await page.addStyleTag({ content: '#tune { opacity: 0 }' })
    await page.waitForTimeout(2500)
    await writeFile(out, tagSrgb(await page.screenshot({ type: 'png' })))
  } finally {
    await browser.close()
  }
}
