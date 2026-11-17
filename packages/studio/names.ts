// The run that names the kept: every Song the Archive holds that has no
// name, named from its own words, and then verified, so that every Song
// has a name, and no slug is worn by two. Made on the Studio's machine,
// before the Radio links Songs by their names alone.
//
//   bun run names          name, and verify
//   bun run names --check  verify only

import { openArchive } from 'archive'
import { holdStudio, StudioBusy } from './lib/lock.js'
import { nameKept, verifyNamed } from './lib/names.js'

try {
  holdStudio()
} catch (error) {
  if (!(error instanceof StudioBusy)) throw error
  console.error(error.message)
  process.exit(1)
}

const { store, where } = openArchive()
console.log(`the Archive is ${where}`)

if (!process.argv.includes('--check')) {
  const { named, unmarked } = await nameKept(store)
  console.log(`${named} Songs named`)
  if (unmarked.length) console.warn(`these Songs have no name yet: ${unmarked.join(', ')}`)
}

const { unmarked, mismatched } = await verifyNamed(store)
if (unmarked.length || mismatched.length) {
  if (unmarked.length) console.error(`Songs without a name: ${unmarked.join(', ')}`)
  if (mismatched.length) console.error(`Songs whose name is worn by another: ${mismatched.join(', ')}`)
  process.exit(1)
}
console.log(`every Song the Archive holds has a name, and no slug is worn by two`)
