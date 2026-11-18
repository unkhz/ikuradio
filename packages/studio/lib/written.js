// Written over the guide (plan "The two-voice guide", step 4): the order a
// song is made in turns over. The words are fitted to their bars first,
// rhythm only; the guide is composed from that rhythm, section by section,
// its chords where the words lean; and only then does the lead get its
// pitches, written over the guide by the writer, every line, every
// iteration anew. The tune the Song remembers gives the words their bars and
// the bridge its journey. The melody is not remembered: it is written again
// from the chords each time, and last iteration's line only pulls at its
// contour, so it drifts instead of jumping.
import { composeGuide, degreeToMidi, modes, standing, vocalRange, wrongness, writeOverGuide, } from 'melody';
/** The degrees a lead may be written in: the compass a verse keeps, within what the body reaches. */
export function compass(key, body) {
    const [lowest, highest] = vocalRange[body];
    const inRange = Array.from({ length: 15 }, (_, k) => k - 5).filter((d) => {
        const midi = degreeToMidi(d, key);
        return midi >= lowest && midi <= highest;
    });
    return [inRange[0] ?? -5, inRange.at(-1) ?? 9];
}
/**
 * A line's timed syllables, from its fitted score: each sounding note a
 * syllable, at `offset` beats into its section, counted at `bpm`. Words
 * whose stress is unknown, or a hum, stand only where they are long.
 */
export function timedLine({ score, words }, offset, bpm) {
    const marks = words?.flatMap((word) => word.stresses.map((stress, i) => ({ stress, begins: i === 0, comma: i === word.stresses.length - 1 && Boolean(word.comma) })));
    const own = [];
    let at = offset;
    for (const [midi, beats] of score.notes) {
        const b = (beats * bpm) / score.bpm;
        if (midi > 0)
            own.push({ at, beats: b, ...(marks?.[own.length] ?? { stress: 0, begins: true, comma: false }), lineEnd: false });
        at += b;
    }
    if (own.length)
        own[own.length - 1].lineEnd = true;
    return own;
}
/** How long a fitted line lasts, in beats at `bpm`. */
const beatsOf = ({ score }, bpm) => score.notes.reduce((sum, [, b]) => sum + (b * bpm) / score.bpm, 0);
/** The longest run of one pitch in a row. */
export function longestRun(degrees) {
    let run = 0;
    let longest = 0;
    for (const [i, d] of degrees.entries()) {
        run = i > 0 && d === degrees[i - 1] ? run + 1 : 1;
        longest = Math.max(longest, run);
    }
    return longest;
}
const cls = (d) => ((d % 7) + 7) % 7;
/** How many standing syllables there are, and how many stand on a tone of the chord sounding under them. */
export function standingOnChord(syllables, degrees, guide) {
    let all = 0;
    let on = 0;
    for (const [i, s] of syllables.entries()) {
        if (!standing(s))
            continue;
        all++;
        const chord = guide.chords.findLast((c) => c.at <= s.at + 1e-9) ?? guide.chords[0];
        if ([0, 2, 4].some((k) => cls(chord.root + k) === cls(degrees[i])))
            on++;
    }
    return { standing: all, onChord: on };
}
/**
 * Every line of an iteration's sections written over its section's guide:
 * the guide composed from the section's fitted rhythm, seeded by its place
 * in the Song and pulled toward the guide the same section had an iteration
 * ago, and each line's pitches by the writer, seeded by the line's place
 * and words, so a line sung twice in an iteration is sung the same. Two
 * sections with the same lines and the same ending share one guide. A line
 * already written, in an earlier section, keeps what it was written.
 */
export function writeSections({ sections, iteration, mode, bpm, lead, before = new Map(), sprinkle, pull, }) {
    const [low, high] = compass(lead.key, lead.body);
    const semitones = (a, b) => Math.abs(degreeToMidi(a, lead.key) - degreeToMidi(b, lead.key));
    const written = new Map();
    const shared = new Map();
    for (const { name, ending, lines, progression, melody } of sections) {
        const timed = [];
        const offsets = [];
        let beats = 0;
        for (const { fitted } of lines) {
            offsets.push(beats);
            timed.push(timedLine(fitted, beats, bpm));
            beats += beatsOf(fitted, bpm);
        }
        const same = `${ending}|${JSON.stringify(progression ?? null)}|${lines.map(({ key }) => key).join('|')}`;
        const guide = shared.get(same) ??
            composeGuide({
                syllables: timed.flat(),
                beats,
                bpm,
                mode: modes[mode],
                ending,
                random: wrongness(`guide:${iteration}:${name}`),
                previous: [...before.values()].find((w) => w.section === name)?.guide,
                progression,
            });
        shared.set(same, guide);
        let from;
        for (const [i, { key, index }] of lines.entries()) {
            const already = written.get(key);
            if (already || !timed[i].length) {
                from = already?.degrees.at(-1) ?? from;
                continue;
            }
            const degrees = writeOverGuide({
                syllables: timed[i],
                guide,
                low,
                high,
                random: wrongness(`melody:${iteration}:${key}`),
                semitones,
                from,
                closes: i === lines.length - 1,
                previous: before.get(`${name}:${index}`)?.degrees,
                sprinkle,
                pull,
                ...melody,
            });
            written.set(key, {
                section: name,
                guide,
                degrees,
                offset: offsets[i],
                ...standingOnChord(timed[i], degrees, guide),
                run: longestRun(degrees),
                ...(progression ? { progression } : {}),
            });
            from = degrees.at(-1);
        }
    }
    return written;
}
/** A score given the writer's pitches, one a sounding note, in the lead's key; unchanged if they do not match its notes. */
export function sungAs(score, degrees, key) {
    if (score.notes.filter(([midi]) => midi > 0).length !== degrees.length)
        return score;
    let k = 0;
    return { ...score, notes: score.notes.map(([midi, beats]) => [midi > 0 ? degreeToMidi(degrees[k++], key) : midi, beats]) };
}
//# sourceMappingURL=written.js.map