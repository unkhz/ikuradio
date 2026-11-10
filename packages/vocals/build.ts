// Builds the throat: Chimera, from its pinned revision, with cargo.
//
//   bun run throat
//
// Nothing is done if the throat is already built at this revision.

import { $ } from 'bun'
import { existsSync } from 'node:fs'

/** The revision of Chimera the song sings with. Move it on purpose, and listen. */
const revision = 'c24945a34296f1cd06c029fd283c43b2a0cc2c26'
const repository = 'https://github.com/jamesondh/chimera-vocal-synth'

const home = new URL('./.chimera/', import.meta.url).pathname
const throat = `${home}target/release/chimera`

const at = existsSync(`${home}.git`)
  ? (await $`git -C ${home} rev-parse HEAD`.nothrow().quiet().text()).trim()
  : ''

if (existsSync(throat) && at === revision) {
  console.log(`the throat is already built at ${revision.slice(0, 7)}`)
} else {
  await $`mkdir -p ${home}`
  if (!existsSync(`${home}.git`)) await $`git init -q ${home}`
  await $`git -C ${home} fetch -q --depth 1 ${repository} ${revision}`
  await $`git -C ${home} checkout -q --detach FETCH_HEAD`
  await $`cargo build --release --quiet --manifest-path ${home}Cargo.toml -p chimera-cli`
  console.log(`built the throat at ${revision.slice(0, 7)}`)
}
