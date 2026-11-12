// Builds the throat: Chimera, from its pinned revision, with cargo, and with
// the song's own changes to it (chimera.patch): each singer may breathe
// through a throat of their own, and a score is sung the same way by the
// command line and by the browser.
//
//   bun run throat
//
// It builds two throats from the one source: the `chimera` command the
// Studio sings with, and `chimera.wasm`, which every Receiver sings with.
// The wasm and the dictionary it reads words with are copied beside the
// Receiver's page (packages/ui/public/throat/), to be committed with it.
//
// Nothing is done if the throat is already built at this revision, with
// this patch.

import { $ } from 'bun'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { patchFile, repository, revision, throatFingerprint } from './lib/throat.js'

const home = new URL('./.chimera/', import.meta.url).pathname
const throat = `${home}target/release/chimera`
const wasm = `${home}target/wasm32-unknown-unknown/release/chimera_wasm.wasm`
/** Where the Receiver's page finds its throat. */
const page = new URL('../ui/public/throat/', import.meta.url).pathname
/** What the throat was last built from: the revision and the patch, as one fingerprint. */
const builtFrom = `${home}.song-built-from`

const wanted = throatFingerprint()
const built = existsSync(builtFrom) ? readFileSync(builtFrom, 'utf8').trim() : ''

if (existsSync(throat) && existsSync(wasm) && built === wanted) {
  console.log(`the throat is already built at ${revision.slice(0, 7)}, with the song's patch`)
} else {
  await $`mkdir -p ${home}`
  if (!existsSync(`${home}.git`)) await $`git init -q ${home}`
  await $`git -C ${home} fetch -q --depth 1 ${repository} ${revision}`
  // the revision as it was, and then the song's change to it
  await $`git -C ${home} checkout -q --force --detach FETCH_HEAD`
  await $`git -C ${home} clean -q -fd crates`
  await $`git -C ${home} apply ${patchFile}`
  await $`cargo build --release --quiet --manifest-path ${home}Cargo.toml -p chimera-cli`
  await $`cargo build --release --quiet --manifest-path ${home}Cargo.toml -p chimera-wasm --target wasm32-unknown-unknown`
  writeFileSync(builtFrom, `${wanted}\n`)
  console.log(`built the throat at ${revision.slice(0, 7)}, with the song's patch`)
}

// the Receiver's throat: the same engine, and the same dictionary of words
mkdirSync(page, { recursive: true })
copyFileSync(wasm, `${page}chimera.wasm`)
copyFileSync(`${home}public/data/cmudict.txt.gz`, `${page}cmudict.txt.gz`)
copyFileSync(`${home}public/data/CMUDICT-LICENSE.txt`, `${page}CMUDICT-LICENSE.txt`)
writeFileSync(`${page}built-from.txt`, `${wanted}\n`)
