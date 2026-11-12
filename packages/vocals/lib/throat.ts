// Which throat the song sings with: Chimera at one revision, with the song's
// own change to it (chimera.patch). The Studio sings with it natively, and
// every Receiver sings with the same code compiled to WebAssembly, so a
// Session's voices sound the same wherever they are sung, sample for sample.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

/** The revision of Chimera the song sings with. Move it on purpose, and listen. */
export const revision = 'c24945a34296f1cd06c029fd283c43b2a0cc2c26'
export const repository = 'https://github.com/jamesondh/chimera-vocal-synth'

/** The song's change to Chimera. */
export const patchFile = new URL('../chimera.patch', import.meta.url).pathname

/** The revision and the patch, as one fingerprint: `<revision> <patch sha256>`. */
export function throatFingerprint() {
  return `${revision} ${createHash('sha256').update(readFileSync(patchFile)).digest('hex')}`
}

/** The fingerprint, short enough to be written into every Session: `<revision 7>+<patch 12>`. */
export function throatName() {
  const [rev, patch] = throatFingerprint().split(' ')
  return `${rev.slice(0, 7)}+${patch.slice(0, 12)}`
}
