// What rhymes with a number.
//
// The chorus says how old the song is, and its second line should rhyme
// with that age: one and begun, two and true, three and sea. The small mind
// cannot hear rhyme, so the song looks it up, in the pronouncing dictionary
// the throat already carries: the sounds of every word, and where its stress
// falls.
//
// Two words rhyme when they sound the same from their last stressed vowel to
// the end. Some numbers have almost no true rhymes (twelve, hundred,
// thousand), so the song settles for the next best thing: the same vowel,
// the way folk songs have always rhymed when they had to.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
/** Reads a dictionary written one word to a line: the word, a tab, its sounds. */
export function parseDictionary(text) {
    const words = new Map();
    for (const line of text.split('\n')) {
        const [word, sounds] = line.split('\t');
        if (word && sounds)
            words.set(word.toLowerCase(), sounds.trim().split(' '));
    }
    return words;
}
const isVowel = (sound) => /\d$/.test(sound);
const plain = (sound) => sound.replace(/\d$/, '');
/** The sounds from the last stressed vowel to the end: what a rhyme must match. */
export function rhymeOf(sounds) {
    let from = -1;
    for (let i = sounds.length - 1; i >= 0; i--) {
        if (/[12]$/.test(sounds[i])) {
            from = i;
            break;
        }
    }
    if (from < 0)
        from = sounds.findLastIndex(isVowel);
    return sounds.slice(Math.max(0, from)).map(plain).join(' ');
}
/** The last stressed vowel alone: what a looser rhyme must match. */
export function vowelOf(sounds) {
    return rhymeOf(sounds).split(' ')[0] ?? '';
}
/** The last word of a line, as the dictionary would spell it. */
export function lastWord(line) {
    const words = line
        .toLowerCase()
        .replace(/[^a-z' -]/g, ' ')
        .split(/[\s-]+/)
        .filter(Boolean);
    return words.at(-1) ?? '';
}
/** A word is plain enough to sing in a chorus: letters only, and short. */
const isPlain = (word) => /^[a-z]{2,7}$/.test(word);
export class Rhymes {
    words;
    byRhyme = new Map();
    byVowel = new Map();
    constructor(words) {
        this.words = words;
        for (const [word, sounds] of words) {
            if (!isPlain(word))
                continue;
            const rhyme = rhymeOf(sounds);
            const vowel = vowelOf(sounds);
            this.byRhyme.set(rhyme, [...(this.byRhyme.get(rhyme) ?? []), word]);
            this.byVowel.set(vowel, [...(this.byVowel.get(vowel) ?? []), word]);
        }
    }
    /**
     * Whether two words rhyme: truly, from their last stressed vowel on, or
     * if `loosely`, only in that vowel. A word does not rhyme with itself.
     */
    rhymes(a, b, loosely = false) {
        const x = this.words.get(a.toLowerCase());
        const y = this.words.get(b.toLowerCase());
        if (!x || !y || a.toLowerCase() === b.toLowerCase())
            return false;
        return loosely ? vowelOf(x) === vowelOf(y) : rhymeOf(x) === rhymeOf(y);
    }
    /**
     * Every plain word that rhymes with `word`, truly, or, when there are too
     * few true rhymes, in its vowel only, which `loosely` says.
     */
    pool(word) {
        const sounds = this.words.get(word.toLowerCase());
        if (!sounds)
            return { words: [], loosely: false };
        const strict = (this.byRhyme.get(rhymeOf(sounds)) ?? []).filter((w) => w !== word);
        const loosely = strict.length < 8;
        const words = loosely
            ? (this.byVowel.get(vowelOf(sounds)) ?? []).filter((w) => w !== word)
            : strict;
        return { words, loosely };
    }
    /**
     * Plain words that rhyme with `word`, a few of them, chosen by `random`.
     * When there are too few true rhymes, the looser ones are offered, and
     * `loosely` says so.
     */
    offer(word, count = 40, random = Math.random) {
        const { words: pool, loosely } = this.pool(word);
        const chosen = [...pool];
        for (let i = chosen.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
        }
        return { words: chosen.slice(0, count), loosely };
    }
}
/** Where the throat keeps its pronouncing dictionary, unless CMUDICT says otherwise. */
function dictionaryPath() {
    return (process.env.CMUDICT ??
        fileURLToPath(new URL('../../vocals/.chimera/public/data/cmudict.txt.gz', import.meta.url)));
}
let loaded;
/** The rhymes of the throat's dictionary, read once. Rejects if the throat has not been built. */
export function rhymes() {
    loaded ??= readFile(dictionaryPath()).then((gz) => new Rhymes(parseDictionary(gunzipSync(gz).toString('utf8'))));
    return loaded;
}
//# sourceMappingURL=rhyme.js.map