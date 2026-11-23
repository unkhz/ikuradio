// A round trip through the Composer's page, end to end, which can be run again:
//
//   bun packages/composer/roundtrip.ts [http://localhost:3200 [folder for what it keeps]]
//
// Against a Composer that is running, with Chrome, it opens the regions of the Song (as a file with no timeline), gives it the id no-bridges, removes every part that has no words, sets the first instance that has a wordiness to 0.9,
// and saves: the file it downloads must be accepted by the parts' own check, and be read back by the
// registry of Arrangements from a folder of its own. Then it gives one instance the name of another that
// is a different part, and sees the refusal on the page, and Save disabled. It captures the page twice, in
// the folder. It names no part: what has no words, and what has a wordiness, it learns from the Composer.
//
// Then, in the same page, it makes the Arrangement `tempo-turns` out of the Song (plan "Evolution of Song", step 11): it copies the
// Song, keeps the regions the other has, in its order, gives one its seconds, makes the tempo map, removes the turn, and puts the Blocks
// on the Tracks one by one, each by its anchors; and saves. The file it downloads must be the text of the file in the repository.

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { arrangementsHome, readArrangements, readParts, refuseArrangement, type Arrangement } from 'parts'

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

  // ---- then the Song becomes tempo-turns, in the editor
  const target = readFileSync(join(arrangementsHome, 'tempo-turns', 'arrangement.json'), 'utf8')
  const want = JSON.parse(target) as { id: string; title: string; instances: { name: string; seconds?: number; ending?: string }[]; tempo: { region?: string; hearing?: number; bpm: number | 'mood' | null }[]; blocks: any[]; tracks: string[] }
  await page.selectOption('#start', 'the-song')
  await page.click('#copy')
  await page.waitForFunction(() => document.querySelectorAll('#instances .row').length === 20)
  await page.fill('#draft-id', want.id)
  await page.fill('#draft-title', want.title)

  // which of the Song's regions are the target's: the nth time a name is heard there is the nth time it is heard here
  const song = first!.declaration.instances
  const used: number[] = []
  const seen = new Map<string, number>()
  for (const { name } of want.instances) {
    const nth = (seen.get(name) ?? 0) + 1
    seen.set(name, nth)
    let found = -1
    for (let i = 0, heard = 0; i < song.length; i++) if (song[i]!.name === name && ++heard === nth) found = i
    must(found >= 0, `the Song has no ${nth}th "${name}" to make the region from`)
    used.push(found)
  }
  // remove the others, last to first; then put the rest in order, an earlier step at a time
  for (let i = song.length - 1; i >= 0; i--) if (!used.includes(i)) await page.locator('#instances .row').nth(i).locator('.remove').click()
  const order = [...used].sort((a, b) => a - b)
  const regionNames = () => page.locator('#instances .iname').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))
  for (let place = 0; place < used.length; place++) {
    const at = order.indexOf(used[place]!)
    for (let k = at; k > place; k--) await page.locator('#instances .row').nth(k).locator('.up').click()
    order.splice(place, 0, ...order.splice(at, 1))
  }
  must(JSON.stringify(await regionNames()) === JSON.stringify(want.instances.map(({ name }) => name)), `the regions are ${JSON.stringify(await regionNames())}`)
  for (const [i, { seconds, ending }] of want.instances.entries()) {
    if (seconds !== undefined) await page.locator('#instances .row').nth(i).locator('[data-field="seconds"]').fill(String(seconds))
    if (ending !== undefined) await page.locator('#instances .row').nth(i).locator('[data-field="ending"]').selectOption(ending)
  }

  // the tempo map: the Song's one change goes, and the other's are made, one by one
  while ((await page.locator('#tempo-points .tempo-row').count()) > 0) await page.locator('#tempo-points .tempo-row').first().locator('.remove').click()
  for (const [i, point] of want.tempo.entries()) {
    await page.click('#add-tempo')
    const row = page.locator('#tempo-points .tempo-row').nth(i)
    await row.locator('[data-field="region"]').selectOption(point.region ?? '')
    if (point.hearing !== undefined) await row.locator('[data-field="hearing"]').fill(String(point.hearing))
    await row.locator('[data-field="mode"]').selectOption(point.bpm === 'mood' ? 'mood' : point.bpm === null ? 'free' : 'number')
    if (typeof point.bpm === 'number') await row.locator('[data-field="bpm"]').fill(String(point.bpm))
  }
  // no turn, and the tracks the other lists
  while ((await page.locator('#turn-points .turn-row').count()) > 0) await page.locator('#turn-points .turn-row').first().locator('.remove').click()
  for (const box of await page.locator('#track-list input').all()) must((await box.isChecked()) === want.tracks.includes((await box.getAttribute('data-track'))!), 'the Tracks the Song lists are not the ones the other lists')

  // the Blocks: all of the Song's go, and the other's are put on, one at a time, by their anchors
  while ((await page.locator('#blocks .block-row').count()) > 0) await page.locator('#blocks .block-row').first().locator('.remove').click()
  for (const [i, block] of want.blocks.entries()) {
    await page.click('#add-block')
    const row = page.locator('#blocks .block-row').nth(i)
    await row.locator('[data-field="track"]').selectOption(block.track)
    await row.locator('[data-field="key"]').fill(block.key)
    for (const side of ['from', 'to'] as const) {
      const anchor = block[side]
      await row.locator(`[data-field="${side}-region"]`).selectOption(anchor.region ?? '')
      if (anchor.hearing !== undefined) await row.locator(`[data-field="${side}-hearing"]`).fill(String(anchor.hearing))
      await row.locator(`[data-field="${side}-edge"]`).selectOption(anchor.edge)
      if (anchor.plus !== undefined) await row.locator(`[data-field="${side}-plus"]`).fill(String(anchor.plus))
    }
    if (block.source) await row.locator('[data-field="source"]').fill(block.source.join(', '))
    for (const name of ['fadeIn', 'fadeOut', 'gain']) if (block[name] !== undefined) await row.locator(`[data-field="${name}"]`).fill(String(block[name]))
  }
  await page.waitForFunction(() => document.querySelector('#verdict')?.classList.contains('accepted'), undefined, { timeout: 10000 }).catch(async () => {
    throw new Error(`round trip: tempo-turns is not accepted: ${await page.locator('#verdict').textContent()}`)
  })
  await page.locator('#edit-view').scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(keep, 'tempo-turns-made.png'), fullPage: true })
  const [made] = await Promise.all([page.waitForEvent('download'), page.click('#save')])
  must(made.suggestedFilename() === 'tempo-turns.json', `the file is called ${made.suggestedFilename()}`)
  const madeAt = join(keep, 'tempo-turns.json')
  await made.saveAs(madeAt)
  must(readFileSync(madeAt, 'utf8') === target, 'the file made in the editor is not the file in the repository')

  console.log(`round trip: ok. kept ${saved}, ${join(keep, 'editing.png')}, ${join(keep, 'refused.png')}`)
} finally {
  await browser.close()
}
process.exit(0)
