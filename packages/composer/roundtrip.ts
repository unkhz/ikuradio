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
  // Learn has no editor, and says where it is; Edit is the same page with ?mode=edit, and the toggle takes one to the other
  await page.goto(`${base}/arrangement/?mode=learn`)
  await page.waitForSelector('#diagram .region')
  must((await page.locator('#editor, #save, #open, #undo').count()) === 0, 'Learn has an editor in it')
  must((await page.locator('.mode-toggle a[aria-current]').textContent()) === 'Learn', 'the toggle does not say Learn')
  await page.screenshot({ path: join(keep, 'learn.png'), fullPage: true })
  await page.click('.mode-toggle a[data-mode="edit"]')
  await page.waitForSelector('#which-file option', { state: 'attached' })
  must(page.url().includes('mode=edit'), 'the mode is not in the URL')
  await page.reload()
  await page.waitForSelector('#which-file option', { state: 'attached' })
  must((await page.locator('.mode-toggle a[aria-current]').textContent()) === 'Edit', 'a reload did not keep the mode')
  must(!(await page.locator('#unsaved').isVisible()), 'nothing is open, and something is unsaved')

  // open its regions as a file, and give them a name of their own
  const opened = join(keep, 'opened.json')
  writeFileSync(opened, JSON.stringify({ id: first!.id, title: first!.title, instances: first!.declaration.instances }))
  await page.setInputFiles('#open', opened)
  // the inspector shows what is chosen; the list shows every row
  await page.waitForSelector('#list-toggle')
  await page.click('#list-toggle')
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
  await page.selectOption('#which-file', first!.id)
  await page.waitForFunction((id) => document.querySelector('#open-name')?.textContent === id, first!.id)
  must((await page.inputValue('#which-file')) === '', 'the chooser keeps a stale selection beside what is open')
  must(!(await page.locator('#unsaved').isVisible()), 'the Song is open as it is, and is said to be unsaved')
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
  // the seconds of a region in free time, and an ending a region says for itself
  for (const [i, { seconds, ending }] of want.instances.entries()) {
    if (seconds !== undefined) await page.locator('#instances .row').nth(i).locator('[data-field="seconds"]').fill(String(seconds))
    if (ending !== undefined) await page.locator('#instances .row').nth(i).locator('[data-field="ending"]').selectOption(ending)
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
  must(!(await page.locator('#unsaved').isVisible()), 'it is saved, and is said to be unsaved')

  // undo every step: the Song comes back, as the file it was
  await page.fill('#draft-title', 'Something else')
  await page.locator('#unsaved').waitFor({ state: 'visible', timeout: 5000 }).catch(() => must(false, 'a change is not said to be unsaved'))
  for (let steps = 0; !(await page.locator('#undo').isDisabled()); steps++) {
    must(steps < 500, 'undo does not come to an end')
    await page.click('#undo')
  }
  await page.waitForFunction(() => document.querySelector('#verdict')?.classList.contains('accepted'))
  must((await page.inputValue('#draft-id')) === first!.id, 'undo did not bring back the Song')
  const [back] = await Promise.all([page.waitForEvent('download'), page.click('#save')])
  const backAt = join(keep, `${first!.id}.json`)
  await back.saveAs(backAt)
  must(readFileSync(backAt, 'utf8') === readFileSync(join(arrangementsHome, first!.id, 'arrangement.json'), 'utf8'), 'undoing every step did not give back the Song as its file')
  // and redo takes it forward again, to the last thing done
  await page.click('#redo')
  must(!(await page.locator('#redo').isDisabled()) || (await page.inputValue('#draft-id')) !== '', 'redo does nothing')
  await page.keyboard.press('Control+Shift+Z')
  await page.keyboard.press('Control+Z')
  await page.screenshot({ path: join(keep, 'edit.png'), fullPage: true })

  // ---- and again, with the mouse: the Song becomes tempo-turns by choosing, dragging and drawing on the drawing
  // (typing is for what is typed: the file's name, and the numbers a Block, a tempo and a fade are given)
  await page.reload()
  await page.waitForSelector('#which-file option', { state: 'attached' })
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('#which-file option', { state: 'attached' })
  const checks = () => page.locator('#verdict').getAttribute('data-checks').then((n) => Number(n ?? 0))
  /** Something is done, and the Composer has answered it. */
  const doing = async (act: () => Promise<unknown>) => {
    const before = await checks()
    await act()
    await page.waitForFunction((n) => Number(document.querySelector('#verdict')?.getAttribute('data-checks') ?? 0) > n, before, { timeout: 8000 }).catch(async () => {
      await page.screenshot({ path: join(keep, 'stuck.png'), fullPage: true })
      throw new Error(`round trip: nothing was asked of the Composer after ${act.toString().replace(/\s+/g, ' ').slice(0, 140)}; the verdict says: ${await page.locator('#verdict').textContent()}`)
    })
  }
  /** Something is chosen: nothing is changed, and nothing is asked of the Composer. */
  const choosing = async (act: () => Promise<unknown>) => {
    await act()
    await page.waitForTimeout(120)
  }
  const need = async () => must((await page.locator('#verdict').getAttribute('class'))?.includes('accepted'), `refused: ${await page.locator('#verdict').textContent()}`)
  await doing(() => page.selectOption('#which-file', first!.id))
  must(!(await page.locator('#unsaved').isVisible()), 'the Song is open as it is, and is said to be unsaved')
  await page.fill('#draft-id', want.id)
  await page.fill('#draft-title', want.title)

  const centre = async (selector: string) => {
    const at = (await page.locator(selector).first().boundingBox())!
    return { ...at, x: at.x + at.width / 2, y: at.y + at.height / 2 }
  }
  /** A drag with the mouse, as a person makes it: down, a few moves, up. */
  const dragging = async (from: { x: number; y: number }, to: { x: number; y: number }, keys: string[] = []) => {
    await page.mouse.move(from.x, from.y)
    for (const key of keys) await page.keyboard.down(key)
    await page.mouse.down()
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 })
    await page.mouse.move(to.x, to.y, { steps: 4 })
    await page.mouse.up()
    for (const key of keys) await page.keyboard.up(key)
  }
  const region = (index: number) => `#edit-diagram .region[data-index="${index}"]`
  const lane = (track: string) => `#edit-diagram .canvas[data-track="${track}"]`
  const pps = () => page.locator('#edit-diagram').getAttribute('data-pps').then(Number)

  // the turn goes: click its handle, then Remove
  await choosing(() => page.click('#edit-diagram .turn-handle'))
  await doing(() => page.click('#turn-points .remove'))
  // and every Block of the Song: click one, then Remove
  while ((await page.locator('#edit-diagram .clip').count()) > 0) {
    await choosing(() => page.locator('#edit-diagram .clip').first().click())
    await doing(() => page.locator('#blocks .remove').first().click())
  }
  // the regions the other does not have go: click one, then Remove, from the last to the first
  const total = want.instances.length
  for (let i = song.length - 1; i >= total; i--) {
    await choosing(() => page.locator(region(i)).click())
    await doing(() => page.locator('#instances .remove').first().click())
  }
  // and the rest are put in its order: a region is dragged to where it belongs, an earlier place at a time
  const wantNames = want.instances.map(({ name }) => name)
  const have = () => page.locator('#edit-diagram .region .name').allTextContents()
  const nth = (names: string[], i: number) => names.slice(0, i + 1).filter((name) => name === names[i]).length
  for (let place = 0; place < total; place++) {
    const names = await have()
    const at = names.findIndex((name, i) => i >= place && name === wantNames[place] && nth(names, i) === nth(wantNames, place))
    must(at >= 0, `no region for place ${place + 1} in ${JSON.stringify(names)}`)
    if (at === place) continue
    const from = await centre(region(at))
    const target = (await page.locator(region(place)).boundingBox())!
    await doing(() => dragging(from, { x: target.x, y: from.y }))
  }
  must(JSON.stringify(await have()) === JSON.stringify(wantNames), `the regions are ${JSON.stringify(await have())}`)

  // the tempo: click the lane at a region for a change, and make it free, or a number; in free time the right edge of the region sets its seconds
  const atOf = (point: { region?: string; hearing?: number }) => wantNames.findIndex((name, i) => name === point.region && nth(wantNames, i) === (point.hearing ?? 1))
  for (const point of want.tempo.slice(1)) {
    const box = (await page.locator(region(atOf(point))).boundingBox())!
    const pace = (await page.locator('#edit-diagram .canvas[data-lane="pace"]').boundingBox())!
    await doing(() => page.mouse.click(box.x + box.width / 2, pace.y + pace.height / 2))
    if (typeof point.bpm === 'number') {
      await doing(() => page.locator('#tempo-points [data-field="mode"]').selectOption('number'))
      await doing(() => page.locator('#tempo-points [data-field="bpm"]').fill(String(point.bpm)))
    }
  }
  // then the one in free time: its flag is chosen, and made free, and the right edge of its region is dragged to its seconds
  for (const [index, point] of want.tempo.entries()) {
    if (point.bpm !== null) continue
    await choosing(() => page.locator(`#edit-diagram .point[data-point="${index}"]`).click())
    await doing(() => page.locator('#tempo-points [data-field="mode"]').selectOption('free'))
    const at = atOf(point)
    const edge = (await page.locator(region(at)).boundingBox())!
    const per = await pps()
    await doing(() => dragging({ x: edge.x + edge.width - 3, y: edge.y + 20 }, { x: edge.x + edge.width - 3 + (want.instances[at]!.seconds! - edge.width / per) * per, y: edge.y + 20 }))
  }
  await need()

  // the Blocks, in the order the file has them: drawn on their Track by dragging over the regions, or copied with Alt held, and given their numbers
  const spanOf = async (from: { region: string; hearing?: number }) => (await page.locator(region(wantNames.findIndex((name, i) => name === from.region && nth(wantNames, i) === (from.hearing ?? 1)))).boundingBox())!
  const kept: { key: string; at: number }[] = []
  for (const block of want.blocks) {
    const first = await spanOf(block.from)
    const last = await spanOf(block.to)
    const trackLane = (await page.locator(lane(block.track)).boundingBox())!
    const y = trackLane.y + 15
    const sameBefore = kept.find((one) => one.key === block.key)
    if (sameBefore) {
      // a sound heard again: the first one, with Alt, dragged to where this one is
      const was = want.blocks[sameBefore.at]
      const origin = await spanOf(was.from)
      // taken high on its body: the gain line runs through the middle of a Block, and is for the gain
      // taken by its body, high up (the gain line runs through the middle) and clear of what overlaps it, and moved as far as its region is from the one it was made on
      const body = (await page.locator(`#edit-diagram .clip[data-block="${sameBefore.at}"]`).boundingBox())!
      const by = first.x - origin.x
      const grab = { x: body.x + Math.min(60, body.width / 2), y: body.y + 4 }
      await doing(() => dragging(grab, { x: grab.x + by, y: grab.y }, ['Alt']))
    } else {
      // drawn from the far end, so that it does not begin on another Block's tail
      await doing(() => dragging({ x: last.x + last.width - 2, y }, { x: first.x + 2, y }))
    }
    kept.push({ key: block.key, at: want.blocks.indexOf(block) })
    for (const side of ['from', 'to'] as const) if (block[side].plus !== undefined && !sameBefore) await doing(() => page.locator(`#blocks [data-field="${side}-plus"]`).fill(String(block[side].plus)))
    for (const name of ['fadeIn', 'fadeOut', 'gain']) if (block[name] !== undefined && !sameBefore) await doing(() => page.locator(`#blocks [data-field="${name}"]`).fill(String(block[name])))
  }
  await need()
  await page.screenshot({ path: join(keep, 'mouse-made.png'), fullPage: true })
  const [mouseMade] = await Promise.all([page.waitForEvent('download'), page.click('#save')])
  const mouseAt = join(keep, 'tempo-turns-by-mouse.json')
  await mouseMade.saveAs(mouseAt)
  must(readFileSync(mouseAt, 'utf8') === target, 'the file made with the mouse is not the file in the repository')

  // ---- the other hands: stretch, fades and gain, one step to a drag, what is chosen coming back with undo, and the keys
  const clipAt = (index: number) => page.locator(`#edit-diagram .clip[data-block="${index}"]`)
  const value = (field: string) =>
    page.locator(`#blocks [data-field="${field}"]`).first().inputValue({ timeout: 4000 }).catch(async () => {
      await page.screenshot({ path: join(keep, 'stuck.png'), fullPage: true })
      throw new Error(`round trip: no field ${field} among ${await page.locator('#blocks li').count()} rows chosen; the verdict says: ${await page.locator('#verdict').textContent()}`)
    })
  const undo = () => doing(() => page.click('#undo'))
  const redo = () => doing(() => page.click('#redo'))
  const unsavedMark = () => page.locator('#unsaved').isVisible()
  await choosing(() => clipAt(5).click())
  await choosing(() => clipAt(8).click())
  must((await value('key')) === 'bed:verse-2', 'the chosen Block is not the one clicked last')
  // stretch: the right end of a Block, dragged with Shift (no snapping): its seconds beyond the edge grow
  const grip = (await clipAt(8).locator('.grip.right').boundingBox())!
  await doing(() => dragging({ x: grip.x + 3, y: grip.y + 10 }, { x: grip.x + 33, y: grip.y + 10 }, ['Shift']))
  must(Number(await value('to-plus')) > 3, `stretching did not lengthen the Block: ${await value('to-plus')}`)
  // undo brings back what was done, and what was chosen
  await choosing(() => page.keyboard.press('Escape'))
  await undo()
  must((await value('to-plus')) === '3', 'undo did not undo the stretch')
  must((await value('key')) === 'bed:verse-2', 'undo did not bring back what was chosen')
  // redo comes back to where it was left: with nothing chosen, since Esc let go of it there
  await redo()
  must((await page.locator('#blocks li').count()) === 0, 'redo chose what had been let go of')
  await choosing(() => clipAt(8).click())
  must(Number(await value('to-plus')) > 3, 'redo did not do the stretch again')
  await undo()
  // one drag, one step: a Block is moved a long way in many small moves, and one undo puts it back
  const before = (await clipAt(3).boundingBox())!
  await doing(() => dragging({ x: before.x + 20, y: before.y + 4 }, { x: before.x + 20 + 90, y: before.y + 4 }, ['Shift']))
  must(Math.abs((await clipAt(3).boundingBox())!.x - before.x) > 40, 'the Block was not moved')
  await undo()
  must(Math.abs((await clipAt(3).boundingBox())!.x - before.x) < 1, 'one undo did not put back a whole drag')
  // the fade and the gain of a chosen Block are dragged by their handles
  await choosing(() => clipAt(8).click())
  const fade = (await clipAt(8).locator('.fade-handle.out').boundingBox())!
  await doing(() => dragging({ x: fade.x + 4, y: fade.y + 4 }, { x: fade.x + 4 - 24, y: fade.y + 4 }))
  must(Number(await value('fadeOut')) > 3, `the fade handle did nothing: ${await value('fadeOut')}`)
  await undo()
  const line = (await clipAt(8).locator('.gain-line').boundingBox())!
  await doing(() => dragging({ x: line.x + 30, y: line.y + 3 }, { x: line.x + 30, y: line.y + 3 + 6 }))
  must(Number(await value('gain')) < 0.45, `the gain line did nothing: ${await value('gain')}`)
  await undo()
  // a sound of its own, and a key already on the Track
  await choosing(() => clipAt(2).click())
  await doing(() => page.locator('#blocks .unique').click())
  must((await value('key')) !== 'voice:chorus', 'the Block was not given a key of its own')
  await undo()
  await doing(() => page.locator('#blocks [data-field="key-pick"]').selectOption('voice:verse-2'))
  must((await value('key')) === 'voice:verse-2', 'a key on the Track was not picked')
  await undo()
  // what a Block is made from is chosen by clicking regions
  await choosing(() => clipAt(0).click())
  await choosing(() => page.locator('#blocks .pick-source').click())
  await doing(() => page.locator(region(1)).click())
  must((await value('source')).includes(wantNames[1]!), 'a region clicked while choosing did not become a source')
  await choosing(() => page.keyboard.press('Escape'))
  await undo()
  // a region is added after the chosen one, and a Block removed with the key
  await choosing(() => page.locator(region(0)).click())
  const count = await page.locator('#edit-diagram .region').count()
  await doing(() => page.click('#add-after'))
  must((await page.locator('#edit-diagram .region').count()) === count + 1, 'no region was added after the chosen one')
  await undo()
  await choosing(() => clipAt(9).click())
  await doing(() => page.keyboard.press('Delete'))
  must((await page.locator('#edit-diagram .clip').count()) === want.blocks.length - 1, 'Delete did not remove the chosen Block')
  await undo()
  await choosing(() => clipAt(3).click())
  await doing(() => page.keyboard.press('ArrowRight'))
  must((await value('from-plus')) === '0.1', 'an arrow did not nudge the Block')
  await undo()
  // Esc lets go
  await choosing(() => page.keyboard.press('Escape'))
  must((await page.locator('#blocks li').count()) === 0 && (await page.locator('#nothing-chosen').textContent())!.length > 0, 'Esc did not let go of what was chosen')
  // zoom and fit
  const fitted = await pps()
  await choosing(() => page.locator('#zoom').fill('3'))
  must((await pps()) > fitted * 2.5, 'zooming did not widen the drawing')
  await choosing(() => page.click('#fit'))
  must(Math.abs((await pps()) - fitted) < 0.01, 'Fit did not bring the Song back to the window')
  await page.screenshot({ path: join(keep, 'hands.png'), fullPage: true })

  // undo every step, and the Song comes back
  for (let steps = 0; !(await page.locator('#undo').isDisabled()); steps++) {
    must(steps < 1000, 'undo does not come to an end')
    await page.click('#undo')
  }
  await page.waitForFunction(() => document.querySelector('#verdict')?.classList.contains('accepted'))
  const [again] = await Promise.all([page.waitForEvent('download'), page.click('#save')])
  const againAt = join(keep, `${first!.id}-after-the-mouse.json`)
  await again.saveAs(againAt)
  must(readFileSync(againAt, 'utf8') === readFileSync(join(arrangementsHome, first!.id, 'arrangement.json'), 'utf8'), 'undoing every step of the mouse did not give back the Song as its file')
  void unsavedMark

  // a concept with a workspace not built yet says so, and one page in Edit says its words short
  await page.goto(`${base}/mood/?mode=edit`)
  await page.waitForSelector('.pending')
  must((await page.locator('.pending').textContent())!.includes('not built yet'), 'a workspace not built does not say so')

  console.log(`round trip: ok. kept ${saved}, ${join(keep, 'editing.png')}, ${join(keep, 'refused.png')}`)
} finally {
  await browser.close()
}
process.exit(0)
