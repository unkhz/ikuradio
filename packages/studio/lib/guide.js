// The guide hums: for every bed the Music grows, the lead hums its melody
// slowly, the same tempo with fewer notes, for the Music to follow. A guide
// for a verse or the chorus is that part's lines slowed to their skeleton.
// A guide for a bridge is the bridge's own journey, from the last notes of
// the part it leaves to the first note of the part it leads to. Every guide
// lasts as long as its section and the tail after it, holding its last
// note, so the Music has a voice to follow while it fades. A guide is never
// heard by anyone: it is what the Music listened to, and the Archive keeps
// it as that, with its score. A bridge heard from a Perspective that takes
// its key away is hummed in a row of all twelve pitches instead, to the same
// rhythm: the Music only ever grows from what it hears.
//
// The two-voice guide (plan "The two-voice guide") hums every section, not
// only the first of each kind: its own chords, composed from its own words,
// in two voices. The lead hums the upper voice, a slow melody; the choir's
// lowest body that reaches it hums the lower, the roots and the bass line.
// Both hum in the Song's key, on A. Each section's bed then grows from its
// own guide.
//
// Why taking turns. MusicGen hears a guide as one pitch class at a time,
// the loudest in each eighth of a second, and nothing else (its feature
// extractor keeps only the argmax of a chromagram). Hummed by the upper
// voice alone, as the guide was before, it heard the chord's root in 31% of
// the chords. With both voices sounding together it heard 59%, with the
// lower louder 83%, and with the lower voice opening each chord and the
// upper finishing it, one at a time, 94%, and 99% of what it heard was a
// chord tone, the most of any rendering. The beds grown from the guide in
// turns lie a little closer to its chords than those grown from the upper
// voice alone: 68% of their pitch energy on the chord tones against 65%,
// with 43% by chance (measured on ten sections, beds grown for four, same
// prompt and seed; thoughts/robot/2026-11.md, "What the band can hear").
// The balance turning between two voices that both sound did as well on
// the root and a little worse on chord tones, and needs a gain that moves;
// taking turns needs nothing but rests. The scientist's ear chose taking
// turns, and with it the melody written over the guide (./written.ts): a
// section's guide is composed before its lines are sung, from their fitted
// rhythm, and hummed here from what was composed.
import { atonal, composeGuide, degreeToMidi, holdLast, inTurns, modes, phraseOf, setBridge, setGuide, vocalRange, wrongness, } from 'melody';
import { createHash } from 'node:crypto';
import { sections, tail } from 'music';
import { makeOnce, mixdown, record, throatScore, vocalsDir } from 'vocals';
import { hum } from './perform.js';
import { stressedLine } from './stressed.js';
import { progressionOf } from './progression.js';
/**
 * Whether each section's guide is the two-voice guide, hummed in turns, the
 * lead's melody written over it, and each section grows its own bed from it.
 * Off, the lead sings its tune, and the Music grows a bed for the first
 * section of each kind from the lead's slow reading of its melody.
 */
export const twoVoices = true;
/**
 * Hums a guide for the first section of each kind of bed in an iteration:
 * the sections the Music grows its beds from. A guide the lead cannot hum
 * is left out, and the Music listens to the sung voice instead.
 */
export async function humGuides(iteration, lines, previous = []) {
    if (twoVoices)
        return humTwoVoices(iteration, lines, previous);
    const { mood, choir, sung: tune, song, settings } = iteration;
    const [lead] = choir;
    const all = sections(lines);
    const first = all.filter((s, i) => all.findIndex((t) => t.kind === s.kind) === i);
    const beatsOf = (seconds) => (seconds * mood.character.tempo) / 60;
    const voice = { singer: lead.body, character: mood.character, harmony: lead.harmony };
    const guides = await Promise.all(first.map(async (section) => {
        const score = section.part === 'bridge'
            ? // a bridge's guide is its journey, from the part it leaves to the one it leads to
                setBridge({
                    from: section.from ?? 'verse',
                    to: section.to ?? 'chorus',
                    lyrics: hum,
                    tune,
                    song: song.number,
                    beats: beatsOf(section.seconds),
                    ...voice,
                })
            : setGuide({
                lines: section.lines.map((line) => ({
                    phrase: phraseOf(tune, line.part, line.index),
                    beats: beatsOf(line.seconds),
                })),
                lyrics: hum,
                ...voice,
            });
        // a bridge that has lost its key is hummed in the Song's row instead, to the same rhythm
        const { row } = settings['bridge-beds'];
        const keyed = section.part === 'bridge' && row ? atonal(score, row) : score;
        const held = holdLast(keyed, beatsOf(tail));
        try {
            // steady, without a singer's wavering: it is a map, not a performance
            const take = { ...held, t0: 0.05, vibrato: 0, ...lead.throat };
            const file = await record(take, lead.body);
            return {
                kind: section.kind,
                part: section.part,
                at: section.at,
                seconds: section.seconds,
                file,
                score: { bpm: held.bpm, notes: held.notes },
                take: throatScore(take),
            };
        }
        catch (error) {
            console.warn(`the lead could not hum the guide for the ${section.kind}: ${error}`);
            return undefined;
        }
    }));
    return guides.filter((guide) => guide !== undefined);
}
/** The key every guide is hummed in: the Song's, on A, the octave the lead hums in. */
const keyOf = (mode) => ({ tonic: 57, mode: modes[mode] });
/**
 * The timed syllables of a section, from what its lead sang: each sounding
 * note a syllable, with the stress the throat's dictionary gives its word.
 * A line whose words cannot be told apart that way lends no syllables, and
 * the guide changes chord less there.
 */
export async function syllablesOf(section, bpm, stressed = stressedLine) {
    const syllables = [];
    for (const line of section.lines) {
        const lead = line.voices.find(({ voice }) => voice === 0) ?? line.voices[0];
        if (!lead || line.unheard || line.part === 'bridge')
            continue;
        const { take } = lead;
        const sounding = take.notes.filter(([midi]) => midi > 0).length;
        const words = await stressed(line.lyrics, sounding).catch(() => undefined);
        if (!words)
            continue;
        const marks = words.flatMap((word) => word.stresses.map((stress, i) => ({ stress, begins: i === 0, comma: i === word.stresses.length - 1 && Boolean(word.comma) })));
        let at = ((line.at - section.at + take.t0) * bpm) / 60;
        const own = [];
        for (const [midi, beats] of take.notes) {
            // the take keeps its own tempo; the guide counts in the Song's
            const b = (beats * bpm) / take.bpm;
            if (midi > 0 && marks[own.length])
                own.push({ at, beats: b, ...marks[own.length], lineEnd: false });
            at += b;
        }
        if (own.length)
            own[own.length - 1].lineEnd = true;
        syllables.push(...own);
    }
    return syllables;
}
/** How far above the bottom of its reach a body must hum the lower voice: near the bottom a voice is mostly overtones, and the Music hears those instead. */
export const roomBelow = 7;
/** The bodies from the lowest reach up. */
const lowestFirst = ['male', 'female', 'child'];
/**
 * Who hums the lower voice: the choir's lowest body that reaches its lowest
 * note, or the male throat when no one in the choir does.
 */
export function lowerVoice(choir, lowest) {
    for (const body of lowestFirst) {
        const member = choir.find((voice) => voice.body === body);
        if (member && vocalRange[body][0] + roomBelow <= lowest)
            return { body, throat: member.throat };
    }
    return { body: 'male' };
}
/** A row turned upside down about its first pitch: the lower voice's row under the upper's. */
export const inversion = (row) => row.map((pitch) => (((2 * row[0] - pitch) % 12) + 12) % 12);
/** A voice in MIDI and beats, a rest being 0, folded by octaves into what `body` reaches. */
function voiceOf(turns, key, body) {
    const [low, high] = vocalRange[body];
    return turns.map(([degree, beats]) => {
        if (degree === null)
            return [0, beats];
        let midi = degreeToMidi(degree, key);
        while (midi < low)
            midi += 12;
        while (midi > high)
            midi -= 12;
        return [midi, beats];
    });
}
/** Folds a score into a body's reach, by octaves: an atonal row may lean below it. */
function within(score, body) {
    const [low, high] = vocalRange[body];
    return {
        ...score,
        notes: score.notes.map(([midi, beats]) => {
            if (midi === 0)
                return [0, beats];
            let m = midi;
            while (m < low)
                m += 12;
            while (m > high)
                m -= 12;
            return [m, beats];
        }),
    };
}
/**
 * The two-voice guide of every section of an iteration, hummed in turns
 * and mixed into the one recording the Music listens to. Each section's
 * guide is composed from its own words, seeded by its place in the Song,
 * and pulled gently toward the guide the same section had an iteration
 * ago. A section the voices cannot hum is left out, and its bed grows as
 * the old guide would have it.
 */
export async function humTwoVoices({ mood, choir, settings, iteration, song }, lines, previous) {
    const bpm = mood.character.tempo;
    const key = keyOf(mood.character.mode);
    const [lead] = choir;
    const all = sections(lines);
    const counted = new Map();
    const named = all.map((section) => {
        const n = counted.get(section.part) ?? 0;
        counted.set(section.part, n + 1);
        return `${section.part}:${n}`;
    });
    const { row } = settings['bridge-beds'];
    const guides = await Promise.all(all.map(async (section, i) => {
        const written = section.lines.flatMap((line) => (line.written ? [line.written] : []));
        const name = written[0]?.section ?? named[i];
        const progression = written[0]?.progression ??
            (await progressionOf(settings.progression[section.part], { part: section.part, place: Number(named[i].split(':')[1]), song: song.number }));
        // a section whose melody was written over its guide hums that guide; any other composes its own
        const composed = written[0]?.guide ?? composeGuide({
            syllables: await syllablesOf(section, bpm),
            beats: (section.seconds * bpm) / 60,
            bpm,
            mode: key.mode,
            // a chorus comes home, and so does the iteration; everything else leaves it open, on the fifth
            ending: section.part === 'chorus' || i === all.length - 1 ? 'full' : 'half',
            random: wrongness(`guide:${iteration}:${name}`),
            previous: previous.find((guide) => guide.name === name)?.composed,
            progression,
        });
        const turns = inTurns(composed, bpm);
        const lowest = Math.min(...turns.lower.flatMap(([d]) => (d === null ? [] : [degreeToMidi(d, key)])));
        const low = lowerVoice(choir, lowest);
        let upper = { bpm, lyrics: '', notes: voiceOf(turns.upper, key, lead.body) };
        let lower = { bpm, lyrics: '', notes: voiceOf(turns.lower, key, low.body) };
        // a bridge that has lost its key: the upper voice hums the row, the lower its inversion
        if (section.part === 'bridge' && row) {
            upper = within(atonal(upper, row), lead.body);
            lower = within(atonal(lower, inversion(row)), low.body);
        }
        const sung = (score, throat) => {
            const held = holdLast(score, (tail * bpm) / 60);
            // steady, without a singer's wavering: it is a map, not a performance
            return { ...held, lyrics: hum(held.notes.filter(([m]) => m > 0).length), t0: 0.05, vibrato: 0, ...throat };
        };
        const upperTake = sung(upper, lead.throat);
        const lowerTake = sung(lower, low.throat);
        try {
            const [high, deep] = await Promise.all([record(upperTake, lead.body), record(lowerTake, low.body)]);
            // two sections that share a guide hum it at the same moment: it is mixed once, and read only whole
            const file = await makeOnce(`${vocalsDir}/${createHash('sha256').update(JSON.stringify({ high, deep })).digest('hex')}.m4a`, (partial) => mixdown([{ file: high, at: 0 }, { file: deep, at: 0 }], partial));
            return {
                kind: section.kind,
                part: section.part,
                at: section.at,
                seconds: section.seconds,
                file,
                score: { bpm, notes: upperTake.notes },
                take: throatScore(upperTake),
                section: i,
                name,
                lower: { take: throatScore(lowerTake), body: low.body },
                composed,
                rendering: 'turns',
                ...(written.length ? { melody: melodyOf(written) } : {}),
                progression,
            };
        }
        catch (error) {
            console.warn(`the voices could not hum the guide for ${name}: ${error}`);
            return undefined;
        }
    }));
    return guides.filter((guide) => guide !== undefined);
}
/** How a section's written melody kept the writer's rules: the share of its standing syllables on a chord tone, and its longest run on one pitch. */
export function melodyOf(written) {
    const standing = written.reduce((sum, w) => sum + w.standing, 0);
    const onChord = written.reduce((sum, w) => sum + w.onChord, 0);
    return { onChord: standing ? Math.round((onChord / standing) * 1000) / 1000 : 1, run: Math.max(...written.map((w) => w.run)) };
}
/** What the Music is given to listen to: a two-voice guide by its section, an old one by its kind. */
export const guidesFor = (hummed) => new Map(hummed.map((guide) => [guide.section ?? guide.kind, guide.file]));
//# sourceMappingURL=guide.js.map