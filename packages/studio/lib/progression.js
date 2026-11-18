// Coming home (plan "Progressions, roaming and coming home"): a part heard
// from a homecoming Perspective sings the chords of a moment the song has
// already sung, one of a critic's favourites, under its new words.
//
// A critic's favourites are a hand-written file in critic/, the scientist's
// first: under each part, Songs, `1`, or one section of a Song, `"45:3"`,
// its third of that part. Nothing here writes there. A favourite is found in
// the Archive by what its Session holds, never by which Song it is: the
// guide hummed for that section, its chords if it kept them, or else its
// one-voice hum heard as chords on the spot; the nearest guide of the same
// part in the same iteration if that section had none of its own, then any
// of that part. A favourite with nothing usable is passed over, with a
// warning, for the next; with none left, the part roams, and says so.
import { readFile } from 'node:fs/promises';
import { harmonizeHum, modes, wrongness } from 'melody';
import { archiveAddress, paths } from 'archive';
/** A critic's favourites for a part, in the order written; anything unreadable is left out. */
export function favouritesOf(critic, part) {
    const listed = critic?.favorites?.[part];
    if (!Array.isArray(listed))
        return [];
    return listed.flatMap((favourite) => {
        const match = /^(\d+)(?::(\d+))?$/.exec(String(favourite).trim());
        if (!match)
            return [];
        return [{ song: match[1], ...(match[2] ? { section: Number(match[2]) } : {}), name: String(favourite).trim() }];
    });
}
/**
 * The chord roots a Session gives a part's section, `place` from 0, by the
 * first fallback that has any: that section's guide (its chords, or its hum
 * heard as chords); the nearest guide of the part in the same iteration;
 * the nearest of the part anywhere. Its sections are counted by place in
 * its first iteration, the last again where it has fewer.
 */
export function chordsIn(session, part, place) {
    const mode = modes[session.mode];
    const first = session.iterations?.[0];
    const own = first?.parts?.filter((p) => p.type === part) ?? [];
    const guides = (session.guides ?? []).filter((g) => g.part === part);
    if (!mode || !guides.length)
        return undefined;
    const target = own[Math.min(place, own.length - 1)];
    const at = target?.at ?? first?.at ?? 0;
    const near = (a, b) => Math.abs(a.at - at) - Math.abs(b.at - at);
    const inFirst = first ? guides.filter((g) => g.at >= first.at - 0.5 && g.at < first.at + first.seconds) : [];
    const exact = guides.find((g) => Math.abs(g.at - at) < 0.5);
    const guide = exact ?? [...inFirst].sort(near)[0] ?? [...guides].sort(near)[0];
    const roots = guide.chords?.length ? guide.chords.map(({ root }) => root) : harmonizeHum(guide.score?.notes ?? [], mode);
    return roots.length ? roots : undefined;
}
/** Where a critic's file is: critic/<name>.json at the project's root. */
const criticFile = (name) => new URL(`../../../critic/${name}.json`, import.meta.url);
const withSlash = (url) => (url.endsWith('/') ? url : `${url}/`);
const critics = new Map();
const sessions = new Map();
/** The Studio's own finding: the critic's file as it is now, the Archive's Sessions, each read once while the Studio lives. */
export const finding = {
    critic: (name) => {
        if (!critics.has(name)) {
            critics.set(name, readFile(criticFile(name), 'utf8')
                .then((text) => JSON.parse(text))
                .catch((error) => {
                console.warn(`the critic ${name} could not be read: ${error.message}`);
                return undefined;
            }));
        }
        return critics.get(name);
    },
    session: (song) => {
        if (!sessions.has(song)) {
            // over HTTP, as a Receiver reads it: reading needs none of the Studio's keys
            const read = async () => {
                const response = await fetch(`${withSlash(archiveAddress())}${paths.session(song)}`);
                if (!response.ok)
                    throw new Error(`the Archive answered ${response.status}`);
                return (await response.json());
            };
            sessions.set(song, read().catch((error) => {
                console.warn(`Song ${song}'s Session could not be read: ${error.message}`);
                return undefined;
            }));
        }
        return sessions.get(song);
    },
    warn: (message) => console.warn(message),
};
/**
 * The progression a section is composed by. A roaming Setting, or a known
 * one with its roots, is used as it is. A known one without roots comes
 * home to a favourite of the critic it names: the Song picks one by its own
 * wrongness, the same for all its sections of the part, each section taking
 * the favourite's section in the same place. A favourite it cannot use is
 * passed over for the next; with none, the section roams.
 */
export async function progressionOf(setting, { part, place, song }, find = finding) {
    if (setting.style !== 'known' || !setting.known || setting.known.roots?.length)
        return setting;
    const name = setting.known.from;
    const favourites = favouritesOf(await find.critic(name), part);
    const start = Math.floor(wrongness(`favourite:${song}:${part}`)() * favourites.length);
    for (let k = 0; k < favourites.length; k++) {
        const favourite = favourites[(start + k) % favourites.length];
        const session = await Promise.resolve()
            .then(() => find.session(favourite.song))
            .catch(() => undefined);
        let roots;
        try {
            roots = session ? chordsIn(session, part, favourite.section ? favourite.section - 1 : place) : undefined;
        }
        catch {
            roots = undefined;
        }
        if (roots)
            return { ...setting, known: { from: `${name}:${favourite.name}`, roots } };
        find.warn(`the ${name}'s favourite ${part} ${favourite.name} gave no chords${session ? '' : ': its Session could not be read'}; the next is tried`);
    }
    find.warn(`none of the ${name}'s favourite ${part}s could be sung; the ${part} roams`);
    return { style: 'roaming', temperature: setting.temperature, pull: setting.pull, unfound: name };
}
//# sourceMappingURL=progression.js.map