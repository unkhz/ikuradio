// Builds the throat: Chimera, from its pinned revision, with cargo, and with
// the song's own small change to it (chimera.patch): each singer may breathe
// through a throat of their own.
//
//   bun run throat
//
// Nothing is done if the throat is already built at this revision, with
// this patch.

import { $ } from 'bun'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/** The revision of Chimera the song sings with. Move it on purpose, and listen. */
const revision = 'c24945a34296f1cd06c029fd283c43b2a0cc2c26'
const repository = 'https://github.com/jamesondh/chimera-vocal-synth'

const home = new URL('./.chimera/', import.meta.url).pathname
const patch = new URL('./chimera.patch', import.meta.url).pathname
const throat = `${home}target/release/chimera`
/** What the throat was last built from: the revision and the patch, as one fingerprint. */
const builtFrom = `${home}.song-built-from`

const wanted = `${revision} ${createHash('sha256').update(readFileSync(patch)).digest('hex')}`
const built = existsSync(builtFrom) ? readFileSync(builtFrom, 'utf8').trim() : ''

if (existsSync(throat) && built === wanted) {
  console.log(`the throat is already built at ${revision.slice(0, 7)}, with the song's patch`)
} else {
  await $`mkdir -p ${home}`
  if (!existsSync(`${home}.git`)) await $`git init -q ${home}`
  await $`git -C ${home} fetch -q --depth 1 ${repository} ${revision}`
  // the revision as it was, and then the song's change to it
  await $`git -C ${home} checkout -q --force --detach FETCH_HEAD`
  await $`git -C ${home} apply ${patch}`
  await $`cargo build --release --quiet --manifest-path ${home}Cargo.toml -p chimera-cli`
  writeFileSync(builtFrom, `${wanted}\n`)
  console.log(`built the throat at ${revision.slice(0, 7)}, with the song's patch`)
}
