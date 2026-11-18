// The Facets: the parts of the Studio's work a Perspective may change. Each
// is one hook in the Studio's code, and each has a Setting: what the hook
// does by default, and all a Perspective may change about it. A Turn takes
// the default Setting and returns its own, never anything else, so a
// Perspective can only change what its Facet's hook offers.
//
// Keep the list in step with .arkku/templates/perspective.ts.
import { roaming, traditional } from 'melody';
export const facets = [
    'development',
    'choir',
    'humanness',
    'harmony',
    'bridge-singers',
    'bridge-voice',
    'bridge-beds',
    'verse-tune',
    'drift',
    'progression',
    'melody',
    'lyrics',
];
/** The melody as the writer always wrote it: the weightiest word two steps below the top, nothing narrowing or stilling it. */
export const usualMelody = { ceiling: 2, span: 0, travel: 0 };
/** The words as the song always wrote them. */
export const usualLyrics = { wordiness: 0.5 };
/** The parts a Setting may be kept for, one each: Perspectives on different parts of one Facet may be heard together. */
export const parts = ['verse', 'chorus', 'bridge'];
/** What the Studio does when no Perspective turns a Facet. */
export function defaults(choirSize) {
    return {
        development: { ornaments: 1, steps: 1 },
        choir: { size: choirSize, verses: false },
        harmony: { ...traditional },
        humanness: { scale: 1 },
        'bridge-singers': { humming: 0.5, choir: false },
        'bridge-voice': {},
        'bridge-beds': { melody: true },
        'verse-tune': { unfamiliar: false },
        drift: { letGo: 1 },
        progression: { verse: { ...roaming }, chorus: { ...roaming }, bridge: { ...roaming } },
        melody: { verse: { ...usualMelody }, chorus: { ...usualMelody }, bridge: { ...usualMelody } },
        lyrics: { verse: { ...usualLyrics }, chorus: { ...usualLyrics } },
    };
}
/** Writes a Perspective's actions, typed for its Facet. */
export function turning(facet, turn) {
    return { facet, turn };
}
/** Picks one of a list by a wrongness. */
export function pick(list, random) {
    if (list.length === 0)
        throw new Error('nothing to pick from');
    return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}
//# sourceMappingURL=facets.js.map