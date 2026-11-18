import { describe, expect, it } from 'bun:test';
import { linkOf, paths, slugOf } from './session.js';
describe('slugOf', () => {
    it('makes the plan example, and nothing else', () => {
        expect(slugOf("Death-machine, the Song's 2nd birth?")).toBe('death-machine-the-songs-2nd-birth');
    });
    it('keeps letters and digits, and removes every other mark', () => {
        expect(slugOf('Hollow death')).toBe('hollow-death');
        expect(slugOf('Hollow death, by boredom')).toBe('hollow-death-by-boredom');
        expect(slugOf('Café Songs')).toBe('café-songs');
        expect(slugOf('Ünïcode')).toBe('ünïcode');
        expect(slugOf('!!!')).toBe('');
        expect(slugOf('')).toBe('');
    });
    it('composes a decomposed letter before slugging', () => {
        const composed = 'Café Songs';
        const decomposed = composed.normalize('NFD');
        expect(slugOf(decomposed)).toBe(slugOf(composed));
    });
    it('drops an apostrophe without a space, and a curly one too', () => {
        expect(slugOf("Song's")).toBe('songs');
        expect(slugOf("L’été d’après")).toBe('lété-daprès');
    });
    it('keeps hyphens and digits as they are', () => {
        expect(slugOf('a-b-c')).toBe('a-b-c');
        expect(slugOf('2nd birth')).toBe('2nd-birth');
    });
    it('trims, lowercases, and makes its spaces single hyphens', () => {
        expect(slugOf('  Spaced   Out  ')).toBe('spaced-out');
        expect(slugOf('UPPER case')).toBe('upper-case');
    });
    it('trims edge hyphens, and runs of them', () => {
        expect(slugOf('---trailing')).toBe('trailing');
        expect(slugOf('leading---')).toBe('leading');
    });
});
describe('linkOf', () => {
    it('is the number, and the slug the name makes', () => {
        expect(linkOf({ song: '1234', name: 'Hollow death, by boredom' })).toEqual({ song: '1234', slug: 'hollow-death-by-boredom' });
    });
    it('is nothing for a Song that has no name', () => {
        expect(linkOf({ song: '1234', name: undefined })).toBeUndefined();
    });
});
describe('paths', () => {
    it('keeps the names the Songs wear, at their own address', () => {
        expect(paths.names).toBe('names.json');
    });
});
//# sourceMappingURL=session.test.js.map