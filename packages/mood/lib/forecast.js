// The song chooses its own weather.
//
// When a new Song begins, one description of the Mood lets go and another
// must arrive. The mind is shown what is leaving, what stays, the weather
// the song has had lately, and the last words it sang, and is asked for one
// new thing to be about, or to sound like. The weather shapes the words, and
// now the words shape the weather.
//
// The mind is small and sometimes says something that cannot be weather: a
// sentence, a list, a word the song has only just let go of. Then the song
// draws from the weather it was given, as before. It never goes without.
import { ask } from 'tools';
const schema = {
    type: 'object',
    properties: {
        description: { type: 'string', maxLength: 60 },
    },
    required: ['description'],
};
const instruction = `You are the weather of a song that never ends. Its mood is a blend of a few short descriptions: a sound or style of music, a place, a thing, a feeling, a moment in time.

One description is leaving the mood. Offer exactly one new description to take its place. It should feel like a natural next step from the mood that remains and from the last words the song sang: close enough to be heard as a change of weather, never a different song.

Answer with two to six words, lowercase, with no punctuation at the end. Do not repeat any description you are shown.`;
/** Small words that carry no weather of their own. */
const small = new Set([
    'a',
    'an',
    'the',
    'of',
    'in',
    'on',
    'at',
    'with',
    'and',
    'to',
    'by',
    'for',
    'from',
]);
/** The words that make a description what it is, with plurals let go. */
function essence(description) {
    return new Set(description
        .toLowerCase()
        .split(/[^\p{L}\p{N}']+/u)
        .filter((word) => word && !small.has(word))
        .map((word) => word.replace(/'s$/, '').replace(/(?<=\w{3})s$/, '')));
}
/**
 * Whether two descriptions are the same weather in different words: when
 * most of what they are made of is shared, as in "whispers of a distant
 * shore" and "a whisper of distant shores".
 */
export function resembles(a, b) {
    const x = essence(a);
    const y = essence(b);
    if (x.size === 0 || y.size === 0)
        return false;
    const shared = [...x].filter((word) => y.has(word)).length;
    return shared / Math.min(x.size, y.size) >= 0.75;
}
/** Whether something the mind said can be weather: a few plain words, nothing the song has just had. */
export function isWeather(description, avoid) {
    const plain = description.trim().toLowerCase();
    const words = plain.split(/\s+/);
    return (words.length >= 1 &&
        words.length <= 7 &&
        plain.length <= 60 &&
        /^[\p{L}\p{N}' -]+$/u.test(plain) &&
        !avoid.some((a) => a.trim().toLowerCase() === plain || resembles(a, plain)));
}
/** Asks the mind for the next weather. Returns nothing if it could not offer any. */
export async function forecast({ staying, leaving, remembered, words, }) {
    const input = [
        `The mood that stays: ${staying.join(' + ') || '(nothing)'}`,
        `Leaving: ${leaving.join(' + ')}`,
        `Recent weather, not to return yet: ${remembered.join(', ') || '(none)'}`,
        `The last words the song sang:\n${words}`,
    ].join('\n');
    try {
        const answer = await ask({
            instruction,
            input,
            schema,
            temperature: 1.0,
        });
        const description = answer?.description?.trim().toLowerCase();
        if (!description)
            return undefined;
        const avoid = [...staying, ...leaving, ...remembered];
        return isWeather(description, avoid) ? description : undefined;
    }
    catch (error) {
        console.warn(`the mind offered no weather: ${error}`);
        return undefined;
    }
}
//# sourceMappingURL=forecast.js.map