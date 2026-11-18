import { fitPhrase, fitToCount, growOnReciting, shortestBeats, spacing } from './lib/fit.js';
import { chorusHook, verseWalk } from './lib/hooks.js';
import { aeolian, degreeToMidi, modes, } from './lib/scale.js';
import { firstTune } from './lib/variation.js';
import { slowSection } from './lib/guide.js';
import { bridgeForm, journey } from './lib/bridge.js';
export { fitPhrase, chorusHook, verseWalk, aeolian, modes, degreeToMidi };
export { firstTune, evolve, step, variations } from './lib/variation.js';
export { wrongness } from './lib/wrongness.js';
export { guideStep, slowPhrase, slowSection } from './lib/guide.js';
export { bridgeForm, journey, walkingDistance } from './lib/bridge.js';
export { atonal, pitchNames, rowName, toneRow } from './lib/atonal.js';
export { changePoints, chordLengths, chordPath, stable, composeGuide, counterpoint, guideCosts, chordsHeard, harmonizeHum, laidByPlace, roaming, inTurns, timedLine, } from './lib/guide.js';
export { degreeOf, nearestDegree, vocalRange } from './lib/reach.js';
export { standing, unfamiliarVerse, writeOverGuide, writerCosts } from './lib/writer.js';
export { harmonizeChoir, parallel, sidesOf, traditional, voiceLine, } from './lib/harmony.js';
export { fitBars, fitToCount, growOnReciting, mostSyllables, paceOf, recitingOf, shortestBeats, spacing, strength, } from './lib/fit.js';
/** The character the song was born with: A minor, slow enough to be mournful, quick enough to keep walking. */
export const firstCharacter = { mode: 'aeolian', tempo: 76 };
/** Every singer sings on A, each in their own octave, in the mode the Mood chose. */
export function keyFor(singer, mode = 'aeolian') {
    return { tonic: singer === 'male' ? 45 : 57, mode: modes[mode] };
}
/** Sets one line of lyrics to its tune, for one voice. */
export function setLine({ part, line, lyrics, syllables, singer, character = firstCharacter, harmony = 0, tune = firstTune, rate, words, }) {
    const phrases = part === 'chorus' ? tune.chorus : tune.verse;
    const phrase = phrases[line % phrases.length];
    const least = rate ? shortestBeats(character.tempo, rate) : undefined;
    const counted = words?.reduce((sum, word) => sum + word.stresses.length, 0);
    // the line that carries the number grows on its reciting note; the tune it
    // is read from may be an old copy, so the mark is read from the hook itself
    const reciting = part === 'chorus' ? chorusHook[line % chorusHook.length]?.reciting : undefined;
    const k = rate ? spacing(character.tempo, rate) : 1;
    let fitted;
    if (rate && words && counted === syllables) {
        if (reciting !== undefined)
            fitted = growOnReciting({ ...phrase, reciting }, words, k);
        else {
            // a line written to its count: its own bars, or one of grace, and never more
            fitted = fitToCount(phrase, words, k)?.phrase;
            if (!fitted)
                throw new NoRoom(`"${lyrics}" does not fit its bars, even with one more`);
        }
    }
    const { notes, rest } = fitted ?? fitPhrase(phrase, syllables, least);
    const key = keyFor(singer, character.mode);
    return {
        bpm: character.tempo,
        lyrics,
        notes: [
            ...notes.map(([degree, beats]) => [
                degreeToMidi(degree + harmony, key),
                beats,
            ]),
            [0, rest],
        ],
    };
}
/** A line whose words do not fit its bars, even with a bar of grace: it was not written to its count, and is not sung. */
export class NoRoom extends Error {
}
/** How many beats a bridge lasts: four bars. */
export const bridgeBeats = 16;
/**
 * The hum of a bridge, for one voice, from part `from` to part `to`: a
 * farewell to the part that has just ended, in its key; the head of the
 * part to come, foreshadowed away from where it begins and then nearer; and
 * a lead-in that stops a step short of its first note, for it to resolve.
 * Or, in an odd `song` where the two parts lie far apart, an echo of the
 * part that ended and a long walk to the coming part's first note.
 * Every part of a Song is in the Song's key today; if a part ever has a key
 * of its own, the bridge already leads from one to the other. `lyrics` is
 * what is hummed, one sound for each note.
 */
export function setBridge({ from, to, lyrics, singer, character = firstCharacter, harmony = 0, tune = firstTune, beats = bridgeBeats, song, }) {
    const phrases = (part) => (part === 'chorus' ? tune.chorus : tune.verse);
    const key = keyFor(singer, character.mode);
    const leaving = phrases(from).at(-1);
    const coming = phrases(to)[0];
    const notes = journey({
        from: leaving,
        fromKey: key,
        to: coming,
        toKey: key,
        beats,
        harmony,
        form: bridgeForm(song, leaving, coming),
    });
    return { bpm: character.tempo, lyrics: lyrics(notes.length), notes };
}
/** A score with its last note held `beats` longer: a tail, for the Music to carry on into. */
export function holdLast(score, beats) {
    if (beats <= 0 || score.notes.length === 0)
        return score;
    const notes = score.notes.map(([midi, b]) => [midi, b]);
    notes[notes.length - 1][1] += beats;
    return { ...score, notes };
}
/** The phrase a line of a part is sung to: lines past the hook wrap around. */
export function phraseOf(tune, part, line) {
    const phrases = part === 'chorus' ? tune.chorus : tune.verse;
    return phrases[line % phrases.length];
}
/**
 * The guide hum of a section, for one voice: its lines' phrases slowed to
 * their skeleton, each lasting as long as its line, in the singer's key.
 * `lyrics` is what is hummed, one sound for each note.
 */
export function setGuide({ lines, lyrics, singer, character = firstCharacter, harmony = 0, }) {
    const key = keyFor(singer, character.mode);
    const notes = slowSection(lines);
    return {
        bpm: character.tempo,
        lyrics: lyrics(notes.length),
        notes: notes.map(([degree, beats]) => [
            degreeToMidi(degree + harmony, key),
            beats,
        ]),
    };
}
/** How long a line takes, rest included, in seconds. */
export function scoreSeconds(score) {
    const beats = score.notes.reduce((sum, [, b]) => sum + b, 0);
    return (beats * 60) / score.bpm;
}
//# sourceMappingURL=index.js.map