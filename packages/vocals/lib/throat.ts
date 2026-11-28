// Which throat the song sings with: Chimera at one revision, with the song's
// own change to it (chimera.patch). The Studio sings with it natively, and
// every Receiver sings with the same code compiled to WebAssembly, so a
// Session's voices sound the same wherever they are sung, sample for sample.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

/**
 * The revision of Chimera the song sings with. Move it on purpose, and listen.
 * It is pinned apart from the speaking throat's (`speechRevision`, below), and
 * the two may be moved apart again: each is built from its own checkout, with
 * its own patch. Both are now at the latest, 0dc13f8, which the scientist heard
 * sing less metallically than c24945a.
 */
export const revision = '030f41af2147aa227f0945c8e68d1fe4df7c1760'
export const repository = 'https://github.com/unkhz/chimera-vocal-synth'

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

/**
 * The throat that speaks, apart from the one that sings (plan "Intro with
 * Rezzy"): Chimera's Speak mode, at the latest revision, so that speech is
 * as good as it gets, with its own small change to it (speech.patch), a
 * `say` call. The singing throat is not touched by it: the two are pinned
 * apart, and may converge one day, on purpose. A DJ speaks with it, in the
 * Studio to fit the words to the room they have, and in a Receiver to say
 * them. Move it on purpose, and listen.
 */
export const speechRevision = '030f41af2147aa227f0945c8e68d1fe4df7c1760'

/** The speaking throat's change to Chimera. */
export const speechPatchFile = new URL('../speech.patch', import.meta.url).pathname

/** The speaking throat's revision and its patch, as one fingerprint. */
export function speechFingerprint() {
  return `${speechRevision} ${createHash('sha256').update(readFileSync(speechPatchFile)).digest('hex')}`
}
