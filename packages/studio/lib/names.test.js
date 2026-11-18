// Naming the kept: each name is written as it comes, and each Song that is
// listed, and not there, is told, and the run goes on to the end.
import { describe, expect, it } from 'bun:test';
import { slugOf } from 'archive';
import { nameKept, verifyNamed } from './names.js';
const session = (song, name) => ({
    song,
    name,
    mood: ['mist rising'],
    iterations: [{ parts: [{ lines: [{ text: `the ${song} words are sung` }] }] }],
});
const store = (sessions, worn = {}, onPut) => ({
    index: async () => ({ songs: sessions.map(({ song }) => song) }),
    names: async () => worn,
    session: async (song) => sessions.find(({ song: n }) => n === song),
    putSession: async () => onPut?.(),
});
describe('nameKept', () => {
    it('names every Song without a name by its own number, and writes each name to the Archive', async () => {
        const kept = [session('1'), session('2'), session('3')];
        let written = 0;
        const { named, missing } = await nameKept(store(kept, {}, () => written++), { quiet: true });
        expect(named).toBe(3);
        expect(missing).toEqual([]);
        expect(written).toBe(3);
        expect(kept.map(({ name }) => name)).toEqual(['Nameless 1', 'Nameless 2', 'Nameless 3']);
    });
    it('leaves the Songs that already have a name', async () => {
        const kept = [session('1', 'Kept'), session('2')];
        const { named } = await nameKept(store(kept), { quiet: true });
        expect(named).toBe(1);
        expect(kept[0].name).toBe('Kept');
        expect(kept[1].name).toBe('Nameless 2');
    });
    it('names a Song apart, when another Song already wears the slug its number makes', async () => {
        const kept = [session('7')];
        const worn = {};
        worn[slugOf('Nameless 7')] = '6';
        const { named } = await nameKept(store(kept, worn), { quiet: true });
        expect(named).toBe(1);
        expect(kept[0].name).toBe('Nameless 7 2');
    });
    it('tells of a Song that is listed, and not there, and goes on', async () => {
        const kept = [session('1'), session('3')];
        const listed = {
            index: async () => ({ songs: ['1', '2', '3'] }),
            names: async () => ({}),
            session: async (song) => kept.find(({ song: n }) => n === song),
            putSession: async () => { },
        };
        const { named, missing } = await nameKept(listed, { quiet: true });
        expect(named).toBe(2);
        expect(missing).toEqual(['2']);
        expect(kept.map(({ name }) => name)).toEqual(['Nameless 1', 'Nameless 3']);
    });
    it('asks the Archive only for the Songs that wear no slug', async () => {
        const kept = [session('1'), session('2'), session('3'), session('4', 'A name'), session('5', 'B name')];
        const worn = {};
        worn[slugOf('A name')] = '4';
        worn[slugOf('B name')] = '5';
        const asked = [];
        const listing = {
            index: async () => ({ songs: kept.map(({ song }) => song) }),
            names: async () => worn,
            session: async (song) => {
                asked.push(song);
                return kept.find(({ song: n }) => n === song);
            },
            putSession: async () => { },
        };
        const { named } = await nameKept(listing, { quiet: true });
        expect(named).toBe(3);
        expect(asked).toEqual(['1', '2', '3']);
    });
});
describe('verifyNamed', () => {
    it('reports the Songs without a name, and the names worn by another', async () => {
        const kept = [session('1'), session('2', 'Hollow Death')];
        const worn = {};
        worn[slugOf('Hollow Death')] = '3';
        const { unmarked, mismatched } = await verifyNamed(store(kept, worn));
        expect(unmarked).toEqual(['1']);
        expect(mismatched).toEqual(['2']);
    });
    it('is silent when every Song has a name, and no slug is worn by two', async () => {
        const kept = [session('1', 'A name'), session('2', 'B name')];
        const worn = {};
        worn[slugOf('A name')] = '1';
        worn[slugOf('B name')] = '2';
        const { unmarked, mismatched } = await verifyNamed(store(kept, worn));
        expect(unmarked).toEqual([]);
        expect(mismatched).toEqual([]);
    });
    it('reports a Song that is listed, and not there, as without a name', async () => {
        const kept = [session('1', 'A name')];
        const worn = {};
        worn[slugOf('A name')] = '1';
        const listed = {
            index: async () => ({ songs: ['1', '2'] }),
            names: async () => worn,
            session: async (song) => kept.find(({ song: n }) => n === song),
            putSession: async () => { },
        };
        const { unmarked } = await verifyNamed(listed);
        expect(unmarked).toEqual(['2']);
    });
});
//# sourceMappingURL=names.test.js.map