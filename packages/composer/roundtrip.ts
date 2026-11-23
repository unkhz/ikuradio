// A round trip through the Composer's page, end to end, which can be run again:
//
//   bun packages/composer/roundtrip.ts [http://localhost:3200 [folder for what it keeps]]
//
// Against a Composer that is running, with Chrome, it opens the regions of the first Arrangement (as a file with no timeline: the
// editor edits the regions until step 11 teaches it blocks), gives it the id no-bridges, removes every part that has no words, sets the first instance that has a wordiness to 0.9,
// and saves: the file it downloads must be accepted by the parts' own check, and be read back by the
// registry of Arrangements from a folder of its own. Then it gives one instance the name of another that
// is a different part, and sees the refusal on the page, and Save disabled. It captures the page twice, in
// the folder. It names no part: what has no words, and what has a wordiness, it learns from the Composer.

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { readArrangements, readParts, refuseArrangement, type Arrangement } from 'parts'

const base = process.argv[2] ?? 'http://localhost:3200'
const keep = resolve(process.argv[3] ?? mkdtempSync(join(tmpdir(), 'composer-roundtrip-')))
mkdirSync(keep, { recursive: true })

const must = (ok: unknown, said: string) => {
  if (!ok) throw new Error(`round trip: ${said}`)
}

type PartJson = { id: string; words: string; parameters: { name: string }[] }
const parts = (await (await fetch(`${base}/parts.json`)).json()) as PartJson[]
const wordless = new Set(parts.filter(({ words }) => words === 'none').map(({ id }) => id))
const listed = (await (await fetch(`${base}/arrangements.json`)).json()) as { id: string; title: string; declaration: Arrangement }[]
// the Song, whose regions have words and bridges to remove; found by its id: the Composer lists its Arrangements by theirs
const first = listed.find(({ id }) => id === 'the-song')
must(first, 'the Composer lists no Arrangement to start from')

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true })).newPage()
  page.on('pageerror', (error) => {
    throw new Error(`round trip: the page: ${error.message}`)
  })
  await page.goto(`${base}/arrangement/`)
  await page.waitForSelector('#diagram .region')

  // open its regions as a file, and give them a name of their own
  const opened = join(keep, 'opened.json')
  writeFileSync(opened, JSON.stringify({ id: first!.id, title: first!.title, instances: first!.declaration.instances }))
  await page.setInputFiles('#open', opened)
  await page.waitForSelector('#instances .row')
  await page.fill('#draft-id', 'no-bridges')
  await page.fill('#draft-title', 'No bridges')

  // remove what has no words, from the last to the first
  const rows = page.locator('#instances .row')
  for (let i = (await rows.count()) - 1; i >= 0; i--) {
    if (wordless.has(await rows.nth(i).locator('.ipart').inputValue())) await rows.nth(i).locator('.remove').click()
  }
  // set a wordiness on the first instance that has one
  const wordy = page.locator('#instances input[data-param="wordiness"]').first()
  await wordy.fill('0.9')
  await page.waitForFunction(() => document.querySelector('#verdict')?.classList.contains('accepted'))
  must(!(await page.locator('#save').isDisabled()), 'Save is disabled though the Arrangement is accepted')
  await page.locator('#edit-view').scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(keep, 'editing.png'), fullPage: true })

  // a name used for two parts is refused, and Save cannot be pressed
  const names = page.locator('#instances .iname')
  const second = await names.nth(1).inputValue()
  await names.nth(1).fill(await names.nth(0).inputValue())
  await page.waitForFunction(() => document.querySelector('#verdict')?.classList.contains('refused'))
  must((await page.locator('#verdict').textContent())?.includes('one name, one part'), 'the refusal does not say one name, one part')
  must(await page.locator('#save').isDisabled(), 'Save is not disabled while the Arrangement is refused')
  await page.screenshot({ path: join(keep, 'refused.png'), fullPage: true })

  // mend it, and save
  await names.nth(1).fill(second)
  await page.waitForFunction(() => document.querySelector('#verdict')?.classList.contains('accepted'))
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#save')])
  must(download.suggestedFilename() === 'no-bridges.json', `the file is called ${download.suggestedFilename()}`)
  const saved = join(keep, 'no-bridges.json')
  await download.saveAs(saved)

  // read back by what the repository itself uses
  const declared: Arrangement = JSON.parse(readFileSync(saved, 'utf8'))
  const records = await readParts()
  must(refuseArrangement(declared, records) === undefined, `the file is refused: ${refuseArrangement(declared, records)}`)
  const home = mkdtempSync(join(tmpdir(), 'arrangements-'))
  const dir = join(home, 'no-bridges')
  mkdirSync(dir)
  writeFileSync(join(dir, 'arrangement.json'), readFileSync(saved))
  writeFileSync(join(dir, 'arrangement.md'), '---\nstate: active\nid: 9\nkind: arrangement\nslug: no-bridges\n---\n# No bridges\n')
  const [read] = await readArrangements(records, home)
  must(read?.arrangement.id === 'no-bridges', 'the registry did not read it')

  const expected = first!.declaration.instances.filter(({ part }) => !wordless.has(part))
  must(read!.arrangement.instances.length === expected.length, `${read!.arrangement.instances.length} instances, not ${expected.length}`)
  expected.forEach(({ name, part }, i) => {
    const got = read!.arrangement.instances[i]!
    must(got.name === name && got.part === part, `instance ${i + 1} is ${got.name}, not ${name}`)
  })
  const carrying = read!.arrangement.instances.flatMap(({ name, parameters }, i) => (parameters ? [[i, name, parameters]] : []))
  must(carrying.length === 1 && carrying[0]![0] === 0 && JSON.stringify(carrying[0]![2]) === '{"wordiness":0.9}', `only the first instance carries a parameter, wordiness 0.9; found ${JSON.stringify(carrying)}`)

  console.log(`round trip: ok. kept ${saved}, ${join(keep, 'editing.png')}, ${join(keep, 'refused.png')}`)
} finally {
  await browser.close()
}
process.exit(0)
