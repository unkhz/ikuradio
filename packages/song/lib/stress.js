// Where a word leans. A line is not a row of equal syllables: "this is the
// SONG, it-er-A-tion" has its weight in two places, and a tune that puts
// "the" on the first beat of a bar and "song" between beats sounds as if it
// does not know the language. So each word's syllables are read with their
// stress, from the pronouncing dictionary the throat already carries (1 the
// main stress, 2 a lesser one, 0 none), the same one the rhymes are found
// in. The small words that hold a line together, the, is, a, and, of, are
// never stressed, whatever the dictionary says of them alone.
import { rhymes } from './rhyme.js';
/** Words too small to lean on: they hold the others together. */
const small = new Set(`a an the and or but nor of to in on at by for from with as is am are was were be been it its
  i me my we us our you your he him his she her they them their this that these those there
  than then so if not no do does did has have had will would can could shall should may might
  must o oh`.split(/\s+/));
/** The stress of each syllable of a word, from its sounds: one for every vowel, as the dictionary marks it. */
export function stressOf(sounds) {
    return sounds.filter((sound) => /\d$/.test(sound)).map((vowel) => Number(vowel.at(-1)));
}
/**
 * The words of `lyrics`, as the throat will sing them (numbers already read
 * aloud, hyphens let apart), with their stress from `dictionary`.
 */
export function stressedWords(lyrics, dictionary) {
    return lyrics
        .split(/\s+/)
        .filter(Boolean)
        .flatMap((token) => {
        const text = token.toLowerCase().replace(/[^a-z']/g, '');
        if (!text)
            return [];
        const sounds = dictionary.get(text);
        // a possessive the dictionary does not know is its word and one more
        // syllable: the throat sings the 's apart, "tune-s"
        const stem = !sounds && text.endsWith("'s") ? dictionary.get(text.slice(0, -2)) : undefined;
        let stresses = sounds ? stressOf(sounds) : stem ? [...stressOf(stem), 0] : undefined;
        if (stresses && stresses.length === 1 && small.has(text))
            stresses = [0];
        return [{ text, stresses, comma: /[,.;:!?—–]$/.test(token) }];
    });
}
/** The words of `lyrics` with their stress, from the throat's own dictionary. Rejects if the throat has not been built. */
export async function stresses(lyrics) {
    return stressedWords(lyrics, (await rhymes()).words);
}
//# sourceMappingURL=stress.js.map