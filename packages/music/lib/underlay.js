// Laying the Music under an iteration. Each part is accompanied once, from
// the first time it is sung: the voice of that section is given to the
// model, and the bed it grows is laid under every section of the part. All
// verses share a tune, and so they share a bed, though their words differ.
import { createHash } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import { describe } from 'mood';
import { mixdown } from 'vocals';
import { accompany, longest, musicDir, tail, words } from './bed.js';
import { sections } from './sections.js';
/** How loud the bed lies under the voice. Under it, never over it. */
export const bedGain = 0.45;
async function exists(file) {
    try {
        return (await stat(file)).isFile();
    }
    catch {
        return false;
    }
}
/** One section's voice alone, as one recording, from its own beginning. */
async function voiceOf(lines, from) {
    const placed = lines
        .filter(({ file }) => file)
        .map(({ file, at }) => ({ file, at: at - from }));
    const name = createHash('sha256').update(JSON.stringify(placed)).digest('hex');
    const file = `${musicDir}/voice-${name}.m4a`;
    if (await exists(file))
        return file;
    await mkdir(musicDir, { recursive: true });
    await mixdown(placed, file);
    return file;
}
/** The Song a Mood belongs to, as the shelf knows it: its weather and its pulse. */
export const songOf = ({ descriptions, character }) => JSON.stringify({ descriptions, tempo: character.tempo, mode: character.mode });
/**
 * Finds a bed for each part of an iteration and places it under every
 * section of that part. With a shelf, a part may play a bed it has played
 * before in this Song instead of growing a new one. Returns the beds as
 * placed recordings, ready to be mixed under the voice or played beside
 * it, the beds that left the shelf, and how many were grown anew.
 */
export async function underlay(lines, mood, { shelf, iteration = 0n, guides, bridgeBeds, } = {}) {
    const all = sections(lines);
    const song = songOf(mood);
    const beds = new Map();
    const own = new Map();
    const kinds = [...new Set(all.map(({ kind }) => kind))];
    const departed = [];
    let grown = 0;
    for (const [i, section] of all.entries()) {
        const guided = guides?.get(i);
        if (guided) {
            // a section with a guide of its own: its own bed, from the shelf only if it grew from this guide
            const kept = shelf?.grownFrom(song, guided);
            if (kept) {
                own.set(i, kept);
                continue;
            }
            const turned = section.part === 'bridge' ? bridgeBeds : undefined;
            const bed = await accompany({
                vocals: guided,
                mood: turned?.instead ? `${turned.instead}, ${mood.character.tempo} bpm` : words(mood),
                seconds: section.seconds + tail,
                melody: turned?.melody ?? true,
            });
            own.set(i, bed);
            grown++;
            if (shelf)
                departed.push(...shelf.keepGuided(song, section.kind, guided, bed, Math.min(longest, section.seconds + tail)));
            continue;
        }
        if (beds.has(section.kind))
            continue;
        const guide = guides?.get(section.kind);
        if (!guide && !section.lines.some(({ file }) => file))
            continue;
        // a bed from the shelf must last as long as this section, and fade under what follows
        const choice = shelf?.choose(iteration, song, section.kind, kinds, section.seconds + tail);
        if (choice && !choice.grow) {
            beds.set(section.kind, choice.bed);
            continue;
        }
        // the Music follows the guide if there is one: a melody moving too fast distracts it
        const vocals = guide ?? (await voiceOf(section.lines, section.at));
        // a section's sung voice is only what the Music listens to; once heard, it is let go
        const turned = section.part === 'bridge' ? bridgeBeds : undefined;
        const bed = await accompany({
            vocals,
            // the tempo is always told; what plays may be the Perspective's, not the Mood's band
            mood: turned?.instead ? `${turned.instead}, ${mood.character.tempo} bpm` : words(mood),
            // grown a little longer than its place, to fade under what follows
            seconds: section.seconds + tail,
            melody: turned?.melody ?? true,
        }).finally(() => (guide ? undefined : rm(vocals, { force: true })));
        beds.set(section.kind, bed);
        grown++;
        if (shelf)
            departed.push(...shelf.keep(song, section.kind, bed, Math.min(longest, section.seconds + tail)));
    }
    if (beds.size === 0 && own.size === 0) {
        console.warn(`no bed grew under ${describe(mood)}: nothing was sung`);
    }
    return {
        beds: all.flatMap(({ kind, at, seconds }, i) => {
            const file = own.get(i) ?? beds.get(kind);
            return file ? [{ file, at, gain: bedGain, seconds, fade: tail }] : [];
        }),
        departed,
        grown,
    };
}
//# sourceMappingURL=underlay.js.map