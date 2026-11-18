import { describe, expect, it } from 'bun:test';
import { defaults } from 'perspectives';
import { cycleAt, readAt, wanderAt } from './envelope.js';
import { applyTides, positionOf, readTides, validRange, valueAt } from './tides.js';
const verse = { age: [3, 6], attack: 0.4, hold: 0.1, decay: 0.3, min: 5, max: 2 };
describe('cycleAt', () => {
    it('lays cycles end to end, each between the shortest and longest age, of differing ages', () => {
        let at = 0;
        const ages = new Set();
        for (let cycle = 0; cycle < 300; cycle++) {
            const found = cycleAt('t', verse.age, at + 0.5);
            expect(found.cycle).toBe(cycle);
            expect(found.begins).toBe(at);
            expect(found.age).toBeGreaterThanOrEqual(3);
            expect(found.age).toBeLessThanOrEqual(6);
            ages.add(found.age);
            // every moment of a cycle finds the same cycle
            expect(cycleAt('t', verse.age, at + found.age - 0.001).cycle).toBe(cycle);
            at += found.age;
        }
        expect(ages.size).toBeGreaterThanOrEqual(3);
    });
    it('cuts eternity differently for different Tides, the same way every time', () => {
        const a = Array.from({ length: 40 }, (_, k) => cycleAt('a', verse.age, k * 3.7).cycle);
        const b = Array.from({ length: 40 }, (_, k) => cycleAt('b', verse.age, k * 3.7).cycle);
        expect(a).not.toEqual(b);
        expect(Array.from({ length: 40 }, (_, k) => cycleAt('a', verse.age, k * 3.7).cycle)).toEqual(a);
    });
    it('finds a Song a quadrillion years away as quickly as the next one', () => {
        const far = 65_000 * 1e15;
        const started = performance.now();
        const found = cycleAt('t', verse.age, far);
        expect(performance.now() - started).toBeLessThan(50);
        expect(found.age).toBeGreaterThanOrEqual(3);
        expect(found.age).toBeLessThanOrEqual(6);
        expect(cycleAt('t', verse.age, far)).toEqual(found);
    });
});
describe('readAt', () => {
    it('rises, holds, falls and rests, by the shares of its cycle', () => {
        const { begins, age } = cycleAt('t', verse.age, 0.1);
        const at = (u) => readAt('t', verse, begins + u * age);
        expect(at(0)).toMatchObject({ value: 5, phase: 'rising', through: 0 });
        expect(at(0.2).value).toBeCloseTo(3.5);
        expect(at(0.2).phase).toBe('rising');
        expect(at(0.45)).toMatchObject({ value: 2, phase: 'holding' });
        expect(at(0.65).value).toBeCloseTo(3.5);
        expect(at(0.65).phase).toBe('falling');
        expect(at(0.9)).toMatchObject({ value: 5, phase: 'resting' });
    });
    it('never jumps: a little later is never much further', () => {
        let last = readAt('t', verse, 0).value;
        for (let p = 0.05; p < 200; p += 0.05) {
            const now = readAt('t', verse, p).value;
            // the steepest slope of the shortest cycle: 3 steps over its decay, 30% of 3 Songs
            expect(Math.abs(now - last)).toBeLessThanOrEqual((3 / (0.3 * 3)) * 0.05 + 1e-9);
            last = now;
        }
    });
});
describe('applyTides', () => {
    const record = (over = {}) => ({
        ...verse,
        moves: { facet: 'melody', part: 'verse', setting: 'ceiling' },
        slug: 'verse-ceiling',
        title: 'x',
        state: 'active',
        dir: '',
        ...over,
    });
    it('leaves the Settings as they are with no active Tide', () => {
        const settings = defaults(3);
        expect(applyTides(settings, [record({ state: 'draft' })], 300.5).settings).toEqual(settings);
        expect(applyTides(settings, [], 300.5)).toEqual({ settings, readings: [] });
    });
    it('moves only its own setting of its own part, and says where it stood', () => {
        const settings = defaults(3);
        const { settings: moved, readings } = applyTides(settings, [record()], 300.5);
        expect(moved.melody.verse.ceiling).toBe(readings[0].value);
        expect(moved.melody.verse.ceiling).toBeGreaterThanOrEqual(2);
        expect(moved.melody.verse.ceiling).toBeLessThanOrEqual(5);
        expect(moved.melody.chorus).toEqual(settings.melody.chorus);
        expect({ ...moved, melody: settings.melody }).toEqual(settings);
        expect(readings[0]).toMatchObject({ slug: 'verse-ceiling', facet: 'melody', part: 'verse', setting: 'ceiling' });
        // the defaults it was given are not changed
        expect(settings.melody.verse.ceiling).toBe(2);
    });
    it('counts a Song’s iterations into its place', () => {
        expect(positionOf('300', 0, 2)).toBe(300);
        expect(positionOf(300n, 1, 2)).toBe(300.5);
    });
});
describe('the Tides', () => {
    it('are all records with an envelope that is one, never two on one setting of one part', async () => {
        const tides = await readTides();
        expect(tides.map((t) => t.slug)).toEqual(['chorus-ceiling', 'chorus-wordiness', 'verse-ceiling', 'verse-wordiness']);
        for (const t of tides)
            expect(t.attack + t.hold + t.decay).toBeLessThanOrEqual(1);
    });
});
describe('the noise', () => {
    const tide = (over = {}) => ({
        ...verse,
        noise: 0.2,
        grain: 0.5,
        moves: { facet: 'melody', part: 'verse', setting: 'ceiling' },
        slug: 'verse-ceiling',
        title: 'x',
        state: 'active',
        dir: '',
        ...over,
    });
    it('wanders no further than its share of the swing, and never past what the setting can be', () => {
        const t = tide();
        for (let p = 0; p < 300; p += 0.13) {
            const { value, envelope } = valueAt(t, p);
            expect(Math.abs(value - envelope)).toBeLessThanOrEqual(0.2 * 3 + 1e-9);
            expect(value).toBeGreaterThanOrEqual(validRange.ceiling[0]);
            expect(value).toBeLessThanOrEqual(validRange.ceiling[1]);
        }
        // a chorus whose peak is the very top is never pushed above it
        const top = tide({ min: 3, max: 0, noise: 0.5 });
        for (let p = 0; p < 300; p += 0.13)
            expect(valueAt(top, p).value).toBeGreaterThanOrEqual(0);
        const words = tide({ moves: { facet: 'lyrics', part: 'verse', setting: 'wordiness' }, min: 0.3, max: 0.95, noise: 0.5 });
        for (let p = 0; p < 300; p += 0.13) {
            const { value } = valueAt(words, p);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        }
    });
    it('follows the envelope exactly with no noise', () => {
        for (let p = 0; p < 100; p += 0.37) {
            const quiet = valueAt(tide({ noise: 0 }), p);
            expect(quiet.value).toBe(quiet.envelope);
            expect(valueAt(tide({ noise: undefined }), p).value).toBe(quiet.envelope);
        }
    });
    it('is the same for the same Song every time, drifts rather than jitters, and is smoother with a larger grain', () => {
        expect(valueAt(tide(), 412.5)).toEqual(valueAt(tide(), 412.5));
        const roughness = (grain) => {
            let sum = 0;
            for (let p = 0; p < 200; p += 0.05)
                sum += Math.abs(wanderAt('t', grain, p + 0.05) - wanderAt('t', grain, p));
            return sum;
        };
        for (let p = 0; p < 200; p += 0.05)
            expect(Math.abs(wanderAt('t', 0.5, p + 0.05) - wanderAt('t', 0.5, p))).toBeLessThan(0.35);
        expect(roughness(2)).toBeLessThan(roughness(0.5));
    });
});
//# sourceMappingURL=tides.test.js.map