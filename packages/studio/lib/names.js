// Naming the kept. A Song that wore no name when it was made — no mind
// gave it one — is named by its own number, so that every Song the Archive
// holds wears a name, and no slug is worn by two. No mind is woken: the
// number is the name, and the namelessness is the Song's own lore. It is
// run on the Studio's machine, against the Archive the Studio publishes
// to.
import { slugOf } from 'archive';
import { namelessOf } from 'song';
/** The Archive, kept: every Song that is there, read eight at a time, as the Studio reads it. */
async function keptOf(store) {
    const { songs } = await store.index();
    const kept = new Map();
    for (let i = 0; i < songs.length; i += 8) {
        const batch = songs.slice(i, i + 8);
        const sessions = await Promise.all(batch.map((song) => store.session(song)));
        batch.forEach((song, j) => {
            const session = sessions[j];
            if (session)
                kept.set(song, session);
        });
    }
    return { songs, kept };
}
/**
 * The Archive, not yet named: the slugs already worn, and the Sessions of
 * the Songs that wear no slug, read eight at a time. A Song that wears a
 * slug is named, and is not read again.
 */
async function unwornOf(store) {
    const { songs } = await store.index();
    const worn = await store.names();
    const wornSongs = new Set(Object.values(worn));
    const unworn = songs.filter((song) => !wornSongs.has(song));
    const kept = new Map();
    for (let i = 0; i < unworn.length; i += 8) {
        const batch = unworn.slice(i, i + 8);
        const sessions = await Promise.all(batch.map((song) => store.session(song)));
        batch.forEach((song, j) => {
            const session = sessions[j];
            if (session)
                kept.set(song, session);
        });
    }
    return { worn, kept, unworn };
}
/**
 * Names every Song the Archive holds that has no name, one at a time, in
 * order, by its own number: no mind is asked, for the number is the name.
 * A Song that wears a slug is named already, and is not read. Returns how
 * many Songs were named, and the numbers of the Songs that are listed,
 * and not there.
 */
export async function nameKept(store, { quiet = false } = {}) {
    const { worn, kept, unworn } = await unwornOf(store);
    let named = 0;
    const missing = [];
    for (const song of unworn) {
        const session = kept.get(song);
        if (!session) {
            // listed in the index, wearing no slug, and not there to read: it cannot be named, and it is told
            missing.push(song);
            if (!quiet)
                console.warn(`Song ${song} is listed, and not there`);
            continue;
        }
        if (session.name)
            continue;
        const name = namelessOf(song, worn);
        session.name = name;
        await store.putSession(session);
        worn[slugOf(name)] = song;
        named++;
        if (!quiet)
            console.log(`Song ${song} is named: ${name}`);
    }
    return { named, missing };
}
/**
 * Verifies that every Song the Archive holds has a name, and that the
 * name's slug is worn by that Song and no other: the check made before
 * Songs are ever linked by their numbers alone. Returns the numbers of
 * the Songs still without a name, and of the Songs whose names are worn
 * by another.
 */
export async function verifyNamed(store) {
    const { songs, kept } = await keptOf(store);
    const worn = await store.names();
    const unmarked = [];
    const mismatched = [];
    for (const song of songs) {
        const session = kept.get(song);
        if (!session) {
            // listed in the index, and not there to read: the check cannot pass for it
            unmarked.push(song);
            continue;
        }
        if (!session.name) {
            unmarked.push(song);
            continue;
        }
        if (worn[slugOf(session.name)] !== song)
            mismatched.push(song);
    }
    return { unmarked, mismatched };
}
//# sourceMappingURL=names.js.map