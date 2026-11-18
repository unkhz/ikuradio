import { describe, expect, it } from 'bun:test';
import { firstMood } from 'mood';
import { firstLyrics } from 'song';
import { firstTune } from 'melody';
import { defaults } from 'perspectives';
import { fittingFor, lastsFor, placeOf } from './compose.js';
const page = (iteration, song) => ({
    iteration: `${iteration}`,
    mood: firstMood,
    lyrics: firstLyrics,
    written: '2026-11-11T00:00:00.000Z',
    ...(song ? { song } : {}),
});
describe('placeOf', () => {
    it('begins the very first Song at the very first iteration', () => {
        expect(placeOf(1n, undefined, 4)).toEqual({
            beginsSong: true,
            number: 1n,
            began: 1n,
        });
    });
    it('reads old pages as Songs of the same length, counted from the start', () => {
        // the scientist's diary: iterations 0 to 7, written when every Song lasted four
        expect(placeOf(6n, page(5), 4)).toMatchObject({
            beginsSong: false,
            number: 1n,
            began: 4n,
            lasts: 4,
        });
        expect(placeOf(8n, page(7), 4)).toMatchObject({
            beginsSong: true,
            number: 2n,
            began: 8n,
        });
    });
    it('holds a Song for as long as it was given', () => {
        const song = { number: '2', began: '8', lasts: 5 };
        expect(placeOf(12n, page(11, song), 4)).toMatchObject({
            beginsSong: false,
            number: 2n,
        });
        expect(placeOf(13n, page(12, song), 4)).toMatchObject({
            beginsSong: true,
            number: 3n,
            began: 13n,
        });
    });
});
describe('lastsFor', () => {
    it('lasts as long as asked, whatever the weather', () => {
        const moods = [
            ['eternity', 'romantic chamber music with violin and cello'],
            ['70s psychedelic funk', 'piano ballad'],
            ['glass', 'tide'],
        ].map((descriptions) => ({
            descriptions,
            character: { mode: 'aeolian', tempo: 76 },
        }));
        expect(moods.map((mood) => lastsFor(mood, 2))).toEqual([2, 2, 2]);
        expect(lastsFor(moods[0], 0)).toBe(1);
    });
});
describe('fittingFor, and how wordy the lines are', () => {
    const tune = async () => firstTune;
    it('counts every line as it always did at the default wordiness, and says nothing more', async () => {
        const usual = fittingFor(await tune(), 80, 6);
        const given = fittingFor(await tune(), 80, 6, defaults(3).lyrics);
        expect(given.verse).toEqual(usual.verse);
        expect(given.chorus).toEqual(usual.chorus);
        expect(given.say).toBeUndefined();
        expect(usual.verse.map(({ target }) => target)).toEqual((await tune()).verse.map((phrase) => phrase.notes.length));
    });
    it('moves the verses and the chorus apart, and never the number line', async () => {
        const sparse = fittingFor(await tune(), 80, 6, { verse: { wordiness: 0.1 }, chorus: { wordiness: 0.95 } });
        const usual = fittingFor(await tune(), 80, 6);
        sparse.verse.forEach((count, i) => expect(count.target).toBeLessThan(usual.verse[i].target));
        expect(sparse.chorus[0]).toEqual(usual.chorus[0]);
        sparse.chorus.slice(1).forEach((count, i) => expect(count.target).toBeGreaterThanOrEqual(usual.chorus[i + 1].target));
        expect(sparse.say?.verse).toContain('few words');
        expect(sparse.say?.chorus).toContain('as many words');
    });
});
//# sourceMappingURL=compose.test.js.map